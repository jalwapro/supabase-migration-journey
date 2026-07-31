import React, { useEffect, useRef, useState } from "react";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import { LevelAvatar } from "@/components/LevelAvatar";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";
import { shouldSkipHeavyEffects } from "@/lib/entrance/registry";

/**
 * Full-screen entrance overlay. Sits above room UI but never blocks pointer
 * events on chat/mic (the Zego audio stream keeps running underneath).
 */
export function EntrancePlayer({ event, onDone }: { event: RoomEntranceEvent; onDone: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visible, setVisible] = useState(true);
  // Video entrances run ~5s; allow them the full clip length.
  const duration = Math.min(Math.max(event.duration_ms ?? 2500, 1200), 6000);


  useEffect(() => {
    // Respect prefers-reduced-motion and slow networks by shortening
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const skipHeavy = shouldSkipHeavyEffects();
    const total = reduce || skipHeavy ? 900 : duration;
    const t1 = setTimeout(() => setVisible(false), total - 250);
    const t2 = setTimeout(onDone, total);
    if (event.sound_url) {
      try {
        const a = new Audio(event.sound_url);
        a.volume = 0.7;
        audioRef.current = a;
        void a.play().catch(() => undefined);
      } catch { /* ignore */ }
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [event.id, duration, onDone, event.sound_url]);

  const mediaType = event.media_type ?? "svg";
  const url = event.media_url ?? "";
  const isVideo = mediaType === "mp4" || mediaType === "webm";
  // Only the equipped shop effect should be visible. When the user has no
  // effect we fall back to a slim entrance bar (no big avatar / name card).
  const hasEffect = url.length > 0;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      {/* Light vignette only while a full effect plays */}
      {hasEffect && <div className="absolute inset-0 bg-black/35" />}

      {/* Animation layer */}
      <div className="absolute inset-0 mx-auto max-w-[480px]">

        {url.startsWith("builtin:") ? (
          <BuiltinEntranceView mediaUrl={url} />
        ) : isVideo ? (
          <EntranceVideoLayer url={url} chromakey={event.chromakey ?? "green"} />
        ) : (
          <img
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter:
                event.chromakey === "green" || event.chromakey === "luma" || event.chromakey === "black"
                  ? "url(#entrance-green-key)"
                  : undefined,
            }}
          />
        )}
        <EntranceChromakeyFilters />
      </div>


      {/* User identity card */}
      <div className="relative z-10 mx-auto flex max-w-[480px] flex-col items-center px-6 text-center">
        <div className="mb-4 animate-[entrance-scale_600ms_cubic-bezier(0.16,1,0.3,1)]">
          <LevelAvatar
            src={event.avatar_url}
            name={event.username}
            level={event.vip_level ?? 0}
            size="xl"
          />
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[color:var(--gold)]/95 to-[#7a5210] px-5 py-2 shadow-2xl">
          <div className="text-lg font-black text-black drop-shadow-sm">
            {event.username ?? "Guest"}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-black/80">
            {event.vip_level ? <span>VIP Lv {event.vip_level}</span> : null}
            {event.country ? <span>· {event.country}</span> : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes entrance-scale {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function EntranceChromakeyFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="entrance-green-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0 0.08" />
          <feComponentTransfer><feFuncA type="linear" slope="3.8" intercept="-0.08" /></feComponentTransfer>
        </filter>
        <filter id="entrance-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer><feFuncA type="linear" slope="5.2" intercept="-0.48" /></feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Video entrance layer. Admin chromakey metadata is often wrong for a clip, and
 * keying a full-scene video erases it entirely — which reads as "the entrance
 * never played". So we sample the first frame's border pixels and only key when
 * the clip really has a green/black backdrop.
 */
function EntranceVideoLayer({ url, chromakey }: { url: string; chromakey: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [detected, setDetected] = useState<"green" | "luma" | "none" | null>(null);
  const [failed, setFailed] = useState(false);

  const detect = () => {
    const video = ref.current;
    if (!video || !video.videoWidth || detected !== null) return;
    try {
      const w = 48;
      const h = Math.max(8, Math.round((video.videoHeight / video.videoWidth) * w));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const pts: Array<[number, number]> = [];
      for (let x = 0; x < w; x++) pts.push([x, 0], [x, h - 1]);
      for (let y = 0; y < h; y++) pts.push([0, y], [w - 1, y]);
      let green = 0;
      let dark = 0;
      for (const [x, y] of pts) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 24) continue;
        if (g > 70 && g > r * 1.35 && g > b * 1.35) green++;
        else if (r + g + b < 96) dark++;
      }
      setDetected(green / pts.length > 0.35 ? "green" : dark / pts.length > 0.55 ? "luma" : "none");
    } catch {
      setDetected(null);
    }
  };

  useEffect(() => {
    setDetected(null);
    setFailed(false);
  }, [url]);

  if (failed) return null;

  const meta = chromakey === "green" || chromakey === "luma" || chromakey === "black";
  const shouldKey = detected ? detected !== "none" : meta;

  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      muted
      playsInline
      preload="auto"
      onLoadedData={() => {
        detect();
        void ref.current?.play().catch(() => undefined);
      }}
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ filter: shouldKey ? "url(#entrance-green-key)" : undefined }}
    />
  );
}
