import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type GiftRow = {
  id: string;
  room_id: string;
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

type ActiveGift = GiftRow;

function numberValue(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function assetUrl(value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${v}`;
  if (v.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${v}`;
  return v;
}

function videoType(src: string | null, declared: string | null | undefined) {
  const clean = (src ?? "").split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".mp4") || clean.endsWith(".mov")) return "mp4";
  return (declared ?? "").toLowerCase();
}

/**
 * Deliberately self-contained gift renderer.
 * No GiftRender/GiftMedia/SVGA/Cinematic imports are used here. This prevents
 * Vite from creating the circular module graph that produced the production
 * TDZ error: "Cannot access 'q' before initialization".
 */
export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<ActiveGift | null>(null);

  useEffect(() => {
    let alive = true;
    const channel = supabase
      .channel(`gift-player-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        payload => {
          if (!alive) return;
          const row = payload.new as GiftRow;
          if (row?.id) setActive(row);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!active) return;
    const cfg = active.gift_render_config ?? {};
    const duration = Math.max(1200, Math.min(15000, numberValue(active.gift_duration_ms ?? cfg.endMs, 3800) + numberValue(cfg.holdMs, 0)));
    const delay = Math.max(0, Math.min(10000, numberValue(cfg.delayMs, 0)));
    const timer = window.setTimeout(() => setActive(null), duration + delay);
    const audioSrc = assetUrl(active.gift_audio_url ?? active.gift_sound_url);
    let audio: HTMLAudioElement | null = null;
    if (audioSrc) {
      audio = new Audio(audioSrc);
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    }
    return () => {
      window.clearTimeout(timer);
      audio?.pause();
      audio = null;
    };
  }, [active]);

  if (!active) return null;

  const cfg = active.gift_render_config ?? {};
  const src = assetUrl(active.gift_clip_path);
  const image = assetUrl(active.gift_image_url ?? active.gift_icon);
  const type = videoType(src, active.gift_clip_type);
  const fit = String(cfg.fit ?? "contain");
  const objectFit = fit === "cover" ? "cover" : fit === "fill" || fit === "stretch" ? "fill" : fit === "original" ? "none" : "contain";
  const scale = numberValue(cfg.scale, 1) * numberValue(cfg.scaleX, 1) * numberValue(cfg.zoom, 1);
  const scaleY = numberValue(cfg.scale, 1) * numberValue(cfg.scaleY, 1) * numberValue(cfg.zoom, 1);
  const x = numberValue(cfg.positionX, 0);
  const y = numberValue(cfg.positionY, 0);
  const opacity = Math.max(0, Math.min(1, numberValue(cfg.opacity, 100) / 100));
  const rotation = numberValue(cfg.rotation, 0);
  const flipX = cfg.flipH ? -1 : 1;
  const flipY = cfg.flipV ? -1 : 1;
  const anchor = String(cfg.anchor ?? "center");
  const centered = anchor === "center" || anchor === "custom";

  const style: React.CSSProperties = {
    position: "absolute",
    left: centered ? `calc(50% + ${x}${cfg.positionUnit === "percent" ? "%" : "px"})` : undefined,
    top: centered ? `calc(50% + ${y}${cfg.positionUnit === "percent" ? "%" : "px"})` : undefined,
    right: anchor.includes("right") ? 0 : undefined,
    bottom: anchor.includes("bottom") ? 0 : undefined,
    transform: `${centered ? "translate(-50%, -50%)" : ""} rotate(${rotation}deg) scale(${scale * flipX}, ${scaleY * flipY})`,
    width: cfg.width ? `${numberValue(cfg.width, 100)}px` : "100%",
    height: cfg.height ? `${numberValue(cfg.height, 100)}px` : "100%",
    opacity,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 2147483647,
  };

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }}>
      <div style={style}>
        {src && (type === "mp4" || type === "webm" || type === "mov" || type === "") ? (
          <video key={active.id} src={src} autoPlay playsInline muted loop={Boolean(active.gift_loop || cfg.loop)} className="h-full w-full" style={{ objectFit }} onError={() => setActive(null)} />
        ) : image ? (
          <img src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={{ objectFit }} onError={() => setActive(null)} />
        ) : (
          <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]">{active.gift_emoji || "🎁"}</div>
        )}
      </div>
      <div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
        {active.sender_username || "User"} sent {active.gift_name || "Gift"}{numberValue(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}
      </div>
    </div>
  );
}
