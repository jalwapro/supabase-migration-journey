import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_GIFT_RENDER,
  normalizeRenderConfig,
  renderConfigToStyle,
  OBJECT_FIT,
  type GiftRenderConfig,
} from "@/lib/giftRender";

type GiftRow = {
  id: string;
  room_id: string;
  sender_id?: string | null;
  receiver_id?: string | null;
  receiver_ids?: string[] | null;
  gift_id?: string | null;
  gift_name?: string | null;
  gift_emoji?: string | null;
  gift_icon?: string | null;
  gift_image_url?: string | null;
  gift_clip_path?: string | null;
  gift_clip_type?: string | null;
  gift_duration_ms?: number | null;
  gift_audio_url?: string | null;
  gift_sound_url?: string | null;
  gift_render_config?: Record<string, unknown> | null;
  gift_loop?: boolean | null;
  quantity?: number | null;
  sender_username?: string | null;
};

const n = (v: unknown, fallback: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const url = (value: string | null | undefined) => {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${v}`;
  if (v.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${v}`;
  return v;
};

const videoKind = (src: string | null, declared?: string | null) => {
  const clean = (src ?? "").split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".mp4") || clean.endsWith(".mov")) return "mp4";
  return (declared ?? "").toLowerCase();
};

export function StableGiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftRow | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const activeRef = useRef<GiftRow | null>(null);
  const queueRef = useRef<GiftRow[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);
  const recentLocalRef = useRef<Array<{ name: string; quantity: number; at: number }>>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const endTimerRef = useRef<number | null>(null);

  const clearEndTimer = useCallback(() => {
    if (endTimerRef.current !== null) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearEndTimer();
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, [clearEndTimer]);

  const enqueue = useCallback((row: GiftRow) => {
    if (!row?.id || seenRef.current.has(row.id)) return;
    seenRef.current.add(row.id);
    seenOrderRef.current.push(row.id);
    if (seenOrderRef.current.length > 500) {
      const old = seenOrderRef.current.shift();
      if (old) seenRef.current.delete(old);
    }
    if (activeRef.current) queueRef.current.push(row);
    else {
      activeRef.current = row;
      setActive(row);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setLocalUserId(data.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setLocalUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const channel = supabase
      .channel(`stable-gifts-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (!alive) return;
          const row = payload.new as GiftRow;
          if (!row?.id) return;

          if (row.sender_id && localUserId && row.sender_id === localUserId) {
            const now = Date.now();
            const duplicate = recentLocalRef.current.some(
              (x) => x.name === (row.gift_name ?? "Gift") && x.quantity === n(row.quantity, 1) && now - x.at < 12000,
            );
            if (duplicate) return;
          }
          enqueue(row);
        },
      )
      .subscribe();

    const onLocalGift = (event: Event) => {
      const d = (event as CustomEvent).detail as Record<string, unknown> | undefined;
      if (!d) return;
      const targets = Array.isArray(d.receiverIds)
        ? d.receiverIds.filter((x): x is string => typeof x === "string")
        : typeof d.receiverId === "string"
          ? [d.receiverId]
          : [];
      if (targets.length && localUserId && !targets.includes(localUserId) && d.local !== true) return;

      const name = typeof d.giftName === "string" ? d.giftName : "Gift";
      const quantity = n(d.quantity, 1);
      recentLocalRef.current.push({ name, quantity, at: Date.now() });
      recentLocalRef.current = recentLocalRef.current.filter((x) => Date.now() - x.at < 12000).slice(-40);

      enqueue({
        id: typeof d.key === "string" ? d.key : `local-gift-${crypto.randomUUID()}`,
        room_id: roomId,
        sender_id: localUserId,
        receiver_id: typeof d.receiverId === "string" ? d.receiverId : null,
        receiver_ids: targets,
        gift_id: typeof d.giftId === "string" ? d.giftId : null,
        gift_name: name,
        gift_emoji: typeof d.giftEmoji === "string" ? d.giftEmoji : "🎁",
        gift_image_url: typeof d.giftImageUrl === "string" ? d.giftImageUrl : null,
        gift_clip_path: typeof d.giftClipUrl === "string" ? d.giftClipUrl : null,
        gift_clip_type: typeof d.giftClipType === "string" ? d.giftClipType : null,
        gift_audio_url: typeof d.soundUrl === "string" ? d.soundUrl : null,
        gift_duration_ms: n(d.durationMs, 0) || null,
        gift_render_config: (d.renderConfig as Record<string, unknown> | null) ?? null,
        gift_loop: false,
        quantity,
        sender_username: typeof d.senderName === "string" ? d.senderName : "User",
      });
    };

    window.addEventListener("jalwa:gift-sent", onLocalGift as EventListener);
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
      window.removeEventListener("jalwa:gift-sent", onLocalGift as EventListener);
    };
  }, [roomId, localUserId, enqueue]);

  useEffect(() => {
    clearEndTimer();
    if (!active) return;

    const cfg = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
    const hardEnd = cfg.endMs != null ? Math.max(300, cfg.endMs) : null;
    const declared = n(active.gift_duration_ms, 0);
    const fallback = declared > 0 ? declared : 15000;
    const duration = hardEnd ?? Math.min(180000, Math.max(1500, fallback + cfg.holdMs));
    const delay = Math.max(0, cfg.delayMs);

    endTimerRef.current = window.setTimeout(() => finish(), delay + duration + 250);
    return clearEndTimer;
  }, [active, clearEndTimer, finish]);

  useEffect(() => {
    return () => {
      clearEndTimer();
      activeRef.current = null;
      queueRef.current = [];
    };
  }, [clearEndTimer]);

  if (!active) return null;

  const cfg: GiftRenderConfig = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
  const src = url(active.gift_clip_path);
  const image = url(active.gift_image_url ?? active.gift_icon);
  const type = videoKind(src, active.gift_clip_type);
  const isVideo = Boolean(src) && ["mp4", "webm", "mov", ""].includes(type);
  const containerStyle = renderConfigToStyle(cfg);
  const crop = cfg.cropTop || cfg.cropRight || cfg.cropBottom || cfg.cropLeft
    ? { clipPath: `inset(${cfg.cropTop}px ${cfg.cropRight}px ${cfg.cropBottom}px ${cfg.cropLeft}px)` }
    : {};
  const filter = [
    `brightness(${Math.max(0, 1 + cfg.brightness / 100)})`,
    `contrast(${Math.max(0, 1 + cfg.contrast / 100)})`,
    `saturate(${Math.max(0, cfg.saturation)})`,
    `hue-rotate(${cfg.hue}deg)`,
    `blur(${Math.max(0, cfg.blurRadius)}px)`,
  ].join(" ");
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: OBJECT_FIT[cfg.fit],
    filter,
    ...crop,
  };

  const handleLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    if (cfg.endMs != null) {
      const end = Math.max(0.3, cfg.endMs / 1000);
      if (video.duration > end) {
        endTimerRef.current = window.setTimeout(finish, Math.max(0, cfg.delayMs) + cfg.endMs + cfg.holdMs);
      }
    }
  };

  const handleEnded = () => finish();
  const loopCount = Math.max(0, Math.floor(cfg.loopCount));
  const loop = cfg.loop && loopCount !== 1;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }} aria-live="polite">
      <div style={containerStyle}>
        {isVideo && src ? (
          <video
            ref={videoRef}
            key={active.id}
            src={src}
            autoPlay
            playsInline
            muted={false}
            controls={false}
            loop={loop}
            preload="auto"
            className="h-full w-full"
            style={mediaStyle}
            onLoadedMetadata={handleLoaded}
            onEnded={handleEnded}
            onError={handleEnded}
          />
        ) : image ? (
          <img src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mediaStyle} onError={handleEnded} />
        ) : (
          <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]" style={{ filter }}>
            {active.gift_emoji || "🎁"}
          </div>
        )}
      </div>
      <div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
        {active.sender_username || "User"} sent {active.gift_name || "Gift"}{n(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}
      </div>
    </div>
  );
}
