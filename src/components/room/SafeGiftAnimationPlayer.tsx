import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolvePlayableGiftUrl, resolveGiftImageUrl } from "@/lib/giftMedia";
import { DEFAULT_GIFT_RENDER, normalizeRenderConfig, renderConfigToStyle, OBJECT_FIT } from "@/lib/giftRender";

type GiftRow = {
  id: string;
  room_id: string;
  sender_username?: string | null;
  sender_avatar?: string | null;
  receiver_username?: string | null;
  receiver_avatar?: string | null;
  gift_name?: string | null;
  gift_emoji?: string | null;
  gift_icon?: string | null;
  gift_image_url?: string | null;
  gift_clip_path?: string | null;
  gift_clip_type?: string | null;
  gift_duration_ms?: number | null;
  gift_sound_url?: string | null;
  gift_audio_url?: string | null;
  gift_render_config?: unknown;
  gift_loop?: boolean | null;
  gift_priority?: number | null;
  quantity?: number | null;
  created_at?: string | null;
};

type ActiveGift = GiftRow & { src: string | null; image: string | null; config: ReturnType<typeof normalizeRenderConfig> };

const PORTAL_ID = "jalwa-gift-animation-layer";
const MAX_Z = 2147483647;

function portalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(PORTAL_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PORTAL_ID;
    document.body.appendChild(root);
  }
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = String(MAX_Z);
  root.style.pointerEvents = "none";
  root.style.isolation = "isolate";
  return root;
}

function mapRow(row: GiftRow): ActiveGift {
  const clip = resolvePlayableGiftUrl(row.gift_clip_path ?? null);
  const image = resolveGiftImageUrl(row.gift_image_url ?? row.gift_icon ?? null);
  return {
    ...row,
    src: clip,
    image,
    config: normalizeRenderConfig(row.gift_render_config ?? DEFAULT_GIFT_RENDER),
  };
}

function inferVideo(src: string | null, type: string | null) {
  const clean = (src ?? "").split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".svga")) return "svga";
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".mp4") || clean.endsWith(".mov")) return "mp4";
  return (type ?? "").toLowerCase();
}

/**
 * Crash-safe fallback for the live room. It deliberately has no dependency on
 * GiftAnimationPlayer/SvgaPlayer/GiftGLVideo, so a bad animation chunk can
 * never prevent VoiceRoomScreen from rendering. It consumes the same
 * gift_sends rows and the same Gift Studio render_config snapshot.
 */
export function SafeGiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<ActiveGift[]>([]);
  const [active, setActive] = useState<ActiveGift | null>(null);

  useEffect(() => {
    let alive = true;
    const channel = supabase
      .channel(`safe-gifts-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        payload => {
          if (!alive) return;
          const row = payload.new as GiftRow;
          if (!row?.id) return;
          const gift = mapRow(row);
          setQueue(prev => prev.some(x => x.id === gift.id) || active?.id === gift.id ? prev : [...prev, gift].slice(-12));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId, active?.id]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    setActive(queue[0]);
    setQueue(prev => prev.slice(1));
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    const cfg = active.config;
    const duration = Math.max(1200, Math.min(15000, Number(active.gift_duration_ms ?? cfg.endMs ?? 3800) + Number(cfg.holdMs ?? 0)));
    const delay = Math.max(0, Math.min(10000, Number(cfg.delayMs ?? 0)));
    const timer = window.setTimeout(() => setActive(null), duration + delay);
    return () => window.clearTimeout(timer);
  }, [active]);

  const root = useMemo(() => portalRoot(), []);
  if (!root || !active) return null;

  const cfg = active.config;
  const type = inferVideo(active.src, active.gift_clip_type);
  const emoji = active.gift_emoji || (active.gift_icon && !/^https?:|^\//i.test(active.gift_icon) ? active.gift_icon : "🎁");
  const style = renderConfigToStyle(cfg);
  const objectFit = OBJECT_FIT[cfg.fit] ?? "contain";

  const content = (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: MAX_Z }}>
      <div style={{ ...style, overflow: "hidden" }}>
        {active.src && (type === "mp4" || type === "webm" || type === "mov" || type === "") ? (
          <video
            key={active.id}
            src={active.src}
            autoPlay
            playsInline
            muted
            loop={Boolean(active.gift_loop || cfg.loop)}
            className="h-full w-full"
            style={{ objectFit, filter: `brightness(${1 + cfg.brightness / 100}) contrast(${1 + cfg.contrast / 100}) saturate(${cfg.saturation})` }}
            onError={() => setActive(null)}
          />
        ) : active.image ? (
          <img src={active.image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={{ objectFit }} onError={() => setActive(null)} />
        ) : (
          <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]" aria-label={active.gift_name ?? "Gift"}>{emoji}</div>
        )}
      </div>
      <div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
        {active.sender_username || "User"} sent {active.gift_name || "Gift"}{Number(active.quantity ?? 1) > 1 ? ` ×${active.quantity}` : ""}
      </div>
    </div>
  );

  return createPortal(content, root);
}
