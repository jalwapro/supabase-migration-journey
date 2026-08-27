import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GiftGLVideo from "@/components/room/GiftGLVideo";
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
 * Live room gift renderer.
 *
 * The render_config on gift_sends is the immutable Gift Studio snapshot.
 * This component deliberately consumes that snapshot through the shared
 * giftRender/GiftGLVideo pipeline so the exact admin configuration travels
 * from Gift Studio -> gifts.render_config -> gift_sends -> VoiceRoom.
 */
export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftRow | null>(null);

  useEffect(() => {
    let alive = true;
    const channel = supabase
      .channel(`gift-player-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        (payload) => {
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
    const cfg = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
    const clipDuration = numberValue(active.gift_duration_ms, cfg.endMs ?? 3800);
    const endMs = cfg.endMs == null ? clipDuration : Math.max(0, cfg.endMs);
    const holdMs = Math.max(0, cfg.holdMs);
    const delayMs = Math.max(0, cfg.delayMs);
    const visibleMs = Math.max(1200, Math.min(30000, endMs + holdMs));
    const totalMs = delayMs + visibleMs;

    const audioSrc = assetUrl(active.gift_audio_url ?? active.gift_sound_url);
    let audio: HTMLAudioElement | null = null;
    let audioTimer: number | undefined;
    if (audioSrc) {
      audioTimer = window.setTimeout(() => {
        audio = new Audio(audioSrc);
        audio.volume = 1;
        void audio.play().catch(() => undefined);
      }, delayMs);
    }

    const timer = window.setTimeout(() => setActive(null), totalMs);
    return () => {
      window.clearTimeout(timer);
      if (audioTimer) window.clearTimeout(audioTimer);
      audio?.pause();
      audio = null;
    };
  }, [active]);

  if (!active) return null;

  const cfg: GiftRenderConfig = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
  const src = assetUrl(active.gift_clip_path);
  const image = assetUrl(active.gift_image_url ?? active.gift_icon);
  const type = videoType(src, active.gift_clip_type);
  const isVideo = Boolean(src) && (type === "mp4" || type === "webm" || type === "mov" || type === "");
  const style = renderConfigToStyle(cfg);
  const fit = OBJECT_FIT[cfg.fit] ?? "contain";

  // Crop is performed by the GPU renderer for video. For still images the
  // same crop is represented by an inset clip-path so Studio crop remains
  // visible even when the gift has no video clip.
  const cropStyle: React.CSSProperties =
    !isVideo && (cfg.cropTop || cfg.cropRight || cfg.cropBottom || cfg.cropLeft)
      ? {
          clipPath: `inset(${cfg.cropTop}px ${cfg.cropRight}px ${cfg.cropBottom}px ${cfg.cropLeft}px)`,
        }
      : {};

  const imageFilter = [
    `brightness(${Math.max(0, 1 + cfg.brightness / 100)})`,
    `contrast(${Math.max(0, 1 + cfg.contrast / 100)})`,
    `saturate(${Math.max(0, cfg.saturation)})`,
    `hue-rotate(${cfg.hue}deg)`,
    `blur(${Math.max(0, cfg.blurRadius)}px)`,
  ].join(" ");

  const mergedMediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fit,
    ...cropStyle,
    ...(isVideo ? {} : { filter: imageFilter }),
  };

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }}>
      <div style={style}>
        {isVideo && src ? (
          <GiftGLVideo
            key={`${active.id}:${cfg.delayMs}:${cfg.endMs ?? "clip"}`}
            src={src}
            config={cfg}
            muted
            loop={Boolean(active.gift_loop || cfg.loop)}
            objectFit={fit}
            className="h-full w-full"
            style={mergedMediaStyle}
            onError={() => setActive(null)}
          />
        ) : image ? (
          <img
            src={image}
            alt={active.gift_name ?? "Gift"}
            className="h-full w-full"
            style={mergedMediaStyle}
            onError={() => setActive(null)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]">
            {active.gift_emoji || "🎁"}
          </div>
        )}
      </div>

      <div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
        {active.sender_username || "User"} sent {active.gift_name || "Gift"}
        {numberValue(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}
      </div>
    </div>
  );
}
