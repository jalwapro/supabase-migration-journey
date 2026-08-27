import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GiftGLVideo from "@/components/room/GiftGLVideo";
import { EntrancePlayer } from "@/components/room/EntrancePlayer";
import { useRoomEntrances } from "@/hooks/useRoomEntrances";
import { DEFAULT_GIFT_RENDER, normalizeRenderConfig, renderConfigToStyle, OBJECT_FIT, type GiftRenderConfig } from "@/lib/giftRender";

type GiftRow = { id: string; room_id: string; gift_name?: string | null; gift_emoji?: string | null; gift_icon?: string | null; gift_image_url?: string | null; gift_clip_path?: string | null; gift_clip_type?: string | null; gift_duration_ms?: number | null; gift_audio_url?: string | null; gift_sound_url?: string | null; gift_render_config?: Record<string, unknown> | null; gift_loop?: boolean | null; quantity?: number | null; sender_username?: string | null; receiver_id?: string | null; receiver_ids?: string[] | null };

function numberValue(v: unknown, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function assetUrl(value: string | null | undefined) { if (!value) return null; const v = value.trim(); if (!v) return null; if (v.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${v}`; if (v.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${v}`; return v; }
function videoType(src: string | null, declared: string | null | undefined) { const clean = (src ?? "").split("?")[0].split("#")[0].toLowerCase(); if (clean.endsWith(".webm")) return "webm"; if (clean.endsWith(".mp4") || clean.endsWith(".mov")) return "mp4"; return (declared ?? "").toLowerCase(); }

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftRow | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const finishTimer = useRef<number | null>(null);
  const { current: currentEntrance, done: doneEntrance } = useRoomEntrances(roomId, localUserId);

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
      if (row?.id) setActive(row);
    }).subscribe();

    const onLocalGift = (event: Event) => {
      const d = (event as CustomEvent).detail as Record<string, unknown> | undefined;
      if (!d) return;
      // The sender must always see their own gift immediately. The previous implementation
      // incorrectly filtered the local sender out because the sender is not a receiver.
      const isLocal = d.local === true;
      const targets = Array.isArray(d.receiverIds) ? d.receiverIds.filter((x): x is string => typeof x === "string") : (typeof d.receiverId === "string" ? [d.receiverId] : []);
      if (!isLocal && targets.length && localUserId && !targets.includes(localUserId)) return;
      setActive({
        id: typeof d.key === "string" ? d.key : `local-${Date.now()}`,
        room_id: roomId,
        gift_name: typeof d.giftName === "string" ? d.giftName : "Gift",
        gift_emoji: typeof d.giftEmoji === "string" ? d.giftEmoji : "🎁",
        gift_image_url: typeof d.giftImageUrl === "string" ? d.giftImageUrl : null,
        gift_clip_path: typeof d.giftClipUrl === "string" ? d.giftClipUrl : null,
        gift_clip_type: typeof d.giftClipType === "string" ? d.giftClipType : null,
        gift_audio_url: typeof d.soundUrl === "string" ? d.soundUrl : null,
        gift_duration_ms: numberValue(d.durationMs, 0) || null,
        gift_render_config: (d.renderConfig as Record<string, unknown> | null) ?? null,
        gift_loop: false,
        quantity: numberValue(d.quantity, 1),
        sender_username: typeof d.senderName === "string" ? d.senderName : "User",
        receiver_id: typeof d.receiverId === "string" ? d.receiverId : null,
        receiver_ids: targets,
      });
    };
    window.addEventListener("jalwa:gift-sent", onLocalGift as EventListener);
    return () => { alive = false; void supabase.removeChannel(channel); window.removeEventListener("jalwa:gift-sent", onLocalGift as EventListener); };
  }, [roomId, localUserId]);

  useEffect(() => {
    if (!active) return;
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    const cfg = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
    const declared = numberValue(active.gift_duration_ms, 0);
    // A gift video must not be cut by the old short render-config timer. For videos the
    // natural `ended` event closes playback; this timeout is only a long safety fallback.
    const safetyMs = Math.min(120000, Math.max(15000, declared || 15000));
    finishTimer.current = window.setTimeout(() => setActive(null), safetyMs);
    const audioSrc = assetUrl(active.gift_audio_url ?? active.gift_sound_url);
    let audio: HTMLAudioElement | null = null;
    if (audioSrc && !active.gift_clip_path) {
      audio = new Audio(audioSrc);
      audio.preload = "auto";
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    }
    return () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); finishTimer.current = null; audio?.pause(); audio = null; };
  }, [active]);

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

  return <>{entranceLayer}<div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }}><div style={style}>{isVideo && src ? <GiftGLVideo key={`${active.id}:${src}`} src={src} config={{ ...cfg, endMs: undefined }} muted={false} volume={1} loop={false} objectFit={fit} className="h-full w-full" style={mergedMediaStyle} onEnded={() => setActive(null)} onError={() => setActive(null)} /> : image ? <img src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mergedMediaStyle} onError={() => setActive(null)} /> : <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]">{active.gift_emoji || "🎁"}</div>}</div><div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">{active.sender_username || "User"} sent {active.gift_name || "Gift"}{numberValue(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}</div></div></>;
}
