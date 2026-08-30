import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GiftGLVideo from "@/components/room/GiftGLVideo";
import { EntrancePlayer } from "@/components/room/EntrancePlayer";
import { useRoomEntrances } from "@/hooks/useRoomEntrances";
import { DEFAULT_GIFT_RENDER, normalizeRenderConfig, renderConfigToStyle, OBJECT_FIT, type GiftRenderConfig } from "@/lib/giftRender";

type GiftRow = { id: string; room_id: string; sender_id?: string | null; receiver_id?: string | null; receiver_ids?: string[] | null; gift_id?: string | null; gift_name?: string | null; gift_emoji?: string | null; gift_icon?: string | null; gift_image_url?: string | null; gift_clip_path?: string | null; gift_clip_type?: string | null; gift_duration_ms?: number | null; gift_audio_url?: string | null; gift_sound_url?: string | null; gift_render_config?: Record<string, unknown> | null; gift_loop?: boolean | null; quantity?: number | null; sender_username?: string | null };

function numberValue(v: unknown, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function assetUrl(value: string | null | undefined) { if (!value) return null; const v = value.trim(); if (!v) return null; if (v.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${v}`; if (v.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${v}`; return v; }
function videoType(src: string | null, declared: string | null | undefined) { const clean = (src ?? "").split("?")[0].split("#")[0].toLowerCase(); if (clean.endsWith(".webm")) return "webm"; if (clean.endsWith(".mp4") || clean.endsWith(".mov")) return "mp4"; return (declared ?? "").toLowerCase(); }

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftRow | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const finishTimer = useRef<number | null>(null);
  const activeRef = useRef<GiftRow | null>(null);
  const queueRef = useRef<GiftRow[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);
  const recentLocalRef = useRef<Array<{ giftId: string | null; quantity: number; at: number }>>([]);
  const { current: currentEntrance, done: doneEntrance } = useRoomEntrances(roomId, localUserId);

  const finishActive = useCallback(() => {
    if (finishTimer.current !== null) { window.clearTimeout(finishTimer.current); finishTimer.current = null; }
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const enqueueGift = useCallback((row: GiftRow) => {
    if (!row?.id) return;
    if (seenIdsRef.current.has(row.id)) return;
    seenIdsRef.current.add(row.id);
    seenOrderRef.current.push(row.id);
    if (seenOrderRef.current.length > 300) {
      const oldId = seenOrderRef.current.shift();
      if (oldId) seenIdsRef.current.delete(oldId);
    }
    if (activeRef.current) queueRef.current.push(row);
    else { activeRef.current = row; setActive(row); }
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => { if (alive) setLocalUserId(data.user?.id ?? null); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setLocalUserId(session?.user?.id ?? null); });
    return () => { alive = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const channel = supabase.channel(`gift-player-${roomId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` }, payload => {
      if (!alive) return;
      const row = payload.new as GiftRow;
      if (!row?.id) return;
      // A successful local send already rendered optimistically. Ignore its Realtime echo.
      if (row.sender_id && localUserId && row.sender_id === localUserId) {
        const now = Date.now();
        const match = recentLocalRef.current.find(x => x.giftId === (row.gift_id ?? null) && x.quantity === numberValue(row.quantity, 1) && now - x.at < 10000);
        if (match) return;
      }
      enqueueGift(row);
    }).subscribe();

    const onLocalGift = (event: Event) => {
      const d = (event as CustomEvent).detail as Record<string, unknown> | undefined;
      if (!d) return;
      const isLocal = d.local === true;
      const targets = Array.isArray(d.receiverIds) ? d.receiverIds.filter((x): x is string => typeof x === "string") : (typeof d.receiverId === "string" ? [d.receiverId] : []);
      if (!isLocal && targets.length && localUserId && !targets.includes(localUserId)) return;
      const quantity = numberValue(d.quantity, 1);
      recentLocalRef.current.push({ giftId: typeof d.giftId === "string" ? d.giftId : null, quantity, at: Date.now() });
      recentLocalRef.current = recentLocalRef.current.filter(x => Date.now() - x.at < 10000).slice(-20);
      enqueueGift({
        id: typeof d.key === "string" ? d.key : `local-${Date.now()}`,
        room_id: roomId,
        sender_id: localUserId,
        gift_id: typeof d.giftId === "string" ? d.giftId : null,
        gift_name: typeof d.giftName === "string" ? d.giftName : "Gift",
        gift_emoji: typeof d.giftEmoji === "string" ? d.giftEmoji : "🎁",
        gift_image_url: typeof d.giftImageUrl === "string" ? d.giftImageUrl : null,
        gift_clip_path: typeof d.giftClipUrl === "string" ? d.giftClipUrl : null,
        gift_clip_type: typeof d.giftClipType === "string" ? d.giftClipType : null,
        gift_audio_url: typeof d.soundUrl === "string" ? d.soundUrl : null,
        gift_duration_ms: numberValue(d.durationMs, 0) || null,
        gift_render_config: (d.renderConfig as Record<string, unknown> | null) ?? null,
        gift_loop: false,
        quantity,
        sender_username: typeof d.senderName === "string" ? d.senderName : "User",
        receiver_id: typeof d.receiverId === "string" ? d.receiverId : null,
        receiver_ids: targets,
      });
    };
    window.addEventListener("jalwa:gift-sent", onLocalGift as EventListener);
    return () => { alive = false; void supabase.removeChannel(channel); window.removeEventListener("jalwa:gift-sent", onLocalGift as EventListener); };
  }, [roomId, localUserId, enqueueGift]);

  useEffect(() => {
    if (!active) return;
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    const declared = numberValue(active.gift_duration_ms, 0);
    const safetyMs = Math.min(180000, Math.max(15000, declared > 0 ? declared + 5000 : 60000));
    finishTimer.current = window.setTimeout(finishActive, safetyMs);
    const audioSrc = assetUrl(active.gift_audio_url ?? active.gift_sound_url);
    let audio: HTMLAudioElement | null = null;
    if (audioSrc && !active.gift_clip_path) {
      audio = new Audio(audioSrc);
      audio.preload = "auto";
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    }
    return () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); finishTimer.current = null; audio?.pause(); audio = null; };
  }, [active, finishActive]);

  useEffect(() => () => {
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    activeRef.current = null;
    queueRef.current = [];
  }, []);

  const entranceLayer = currentEntrance ? <EntrancePlayer event={currentEntrance} onDone={doneEntrance} /> : null;
  if (!active) return entranceLayer;

  const cfg: GiftRenderConfig = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
  const src = assetUrl(active.gift_clip_path);
  const image = assetUrl(active.gift_image_url ?? active.gift_icon);
  const type = videoType(src, active.gift_clip_type);
  const isVideo = Boolean(src) && (type === "mp4" || type === "webm" || type === "mov" || type === "");
  const style = renderConfigToStyle(cfg);
  const fit = OBJECT_FIT[cfg.fit] ?? "contain";
  const cropStyle: React.CSSProperties = !isVideo && (cfg.cropTop || cfg.cropRight || cfg.cropBottom || cfg.cropLeft) ? { clipPath: `inset(${cfg.cropTop}px ${cfg.cropRight}px ${cfg.cropBottom}px ${cfg.cropLeft}px)` } : {};
  const imageFilter = [`brightness(${Math.max(0, 1 + cfg.brightness / 100)})`, `contrast(${Math.max(0, 1 + cfg.contrast / 100)})`, `saturate(${Math.max(0, cfg.saturation)})`, `hue-rotate(${cfg.hue}deg)`, `blur(${Math.max(0, cfg.blurRadius)}px)`].join(" ");
  const mergedMediaStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit, ...cropStyle, ...(isVideo ? {} : { filter: imageFilter }) };

  const handleDuration = useCallback((ms: number) => {
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    const safeMs = Math.min(180000, Math.max(1500, ms + 3000));
    finishTimer.current = window.setTimeout(finishActive, safeMs);
  }, [finishActive]);

  return <>{entranceLayer}<div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }}><div style={style}>{isVideo && src ? <GiftGLVideo key={`${active.id}:${src}`} src={src} config={{ ...cfg, endMs: undefined }} muted={false} volume={1} loop={false} objectFit={fit} className="h-full w-full" style={mergedMediaStyle} onDuration={handleDuration} onEnded={finishActive} onError={finishActive} /> : image ? <img src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mergedMediaStyle} onError={finishActive} /> : <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]">{active.gift_emoji || "🎁"}</div>}</div><div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">{active.sender_username || "User"} sent {active.gift_name || "Gift"}{numberValue(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}</div></div></>;
}
