import React, { useEffect, useRef, useState } from "react";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";
import { shouldSkipHeavyEffects } from "@/lib/entrance/registry";

/**
 * Voice-room entrance presentation.
 *
 * The entrance identity bar belongs to the fixed mobile room flow: directly
 * under the seats and immediately above the chat/activity area. It slides in
 * from the left, stays compact, never captures pointer events, and works for
 * every entry (with or without an equipped entrance effect).
 */
export function EntrancePlayer({ event, onDone }: { event: RoomEntranceEvent; onDone: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const [visible, setVisible] = useState(true);

  onDoneRef.current = onDone;

  const duration = Math.min(Math.max(event.duration_ms ?? 2500, 1200), 6000);
  const level = Math.max(0, Number(event.vip_level ?? 0));
  const tier = level >= 100 ? "LEGEND" : level >= 50 ? "DIAMOND" : level >= 25 ? "PLATINUM" : level >= 10 ? "GOLD" : "VIP";

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  useEffect(() => {
    doneRef.current = false;
    setVisible(true);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const skipHeavy = shouldSkipHeavyEffects();
    const total = reduce || skipHeavy ? 900 : duration;

    const hideTimer = window.setTimeout(() => setVisible(false), Math.max(0, total - 250));
    const doneTimer = window.setTimeout(finish, total);

    if (event.sound_url) {
      try {
        const audio = new Audio(event.sound_url);
        audio.volume = 0.7;
        audioRef.current = audio;
        void audio.play().catch(() => undefined);
      } catch {
        // Audio is optional; the entrance bar must still play.
      }
    }

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // onDone intentionally comes from a ref so parent rerenders cannot restart the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, duration, event.sound_url]);

  const mediaType = event.media_type ?? "svg";
  const url = event.media_url ?? "";
  const isVideo = mediaType === "mp4" || mediaType === "webm";
  const hasEffect = url.length > 0;

  return (
    <>
      {/* Keep the visual entrance effect behind the room UI. It never blocks controls. */}
      {hasEffect && (
        <div
          className={`pointer-events-none fixed inset-0 z-[998] transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          aria-hidden
        >
          <div className="absolute inset-0 mx-auto max-w-[480px]">
            {url.startsWith("builtin:") ? (
              <BuiltinEntranceView mediaUrl={url} />
            ) : isVideo ? (
              <EntranceVideoLayer url={url} chromakey={event.chromakey ?? "green"} onEnded={finish} />
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
        </div>
      )}

      {/*
       * The important part: the entrance bar is anchored to the boundary
       * between seats and chat. The chat area remains underneath it and the
       * bar slides in/out without shifting the room layout.
       */}
      <div
        className={`pointer-events-none fixed inset-x-0 z-[999] flex justify-center px-2 transition-all duration-500 ease-out ${
          visible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
        style={{ bottom: "max(22dvh, 148px)" }}
        aria-hidden
      >
        <div className="w-full max-w-[480px]">
          <div className="mx-auto flex h-[42px] w-fit max-w-full items-center gap-2 overflow-hidden rounded-full border border-white/20 bg-black/80 px-2.5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,.42)] backdrop-blur-xl">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--primary)] bg-black/40 shadow-[0_0_12px_rgba(255,255,255,.12)]">
              {event.avatar_url ? (
                <img src={event.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-black text-white">
                  {(event.username ?? "G").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 max-w-[235px] text-left leading-none">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="max-w-[145px] truncate text-[11px] font-black text-white">
                  {event.username ?? "Guest"}
                </span>
                <span className="shrink-0 rounded-full border border-[color:var(--primary)]/70 bg-[color:var(--primary)]/20 px-1.5 py-0.5 text-[7px] font-black tracking-wider text-white">
                  LV {level}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/65">
                <span className="text-[color:var(--primary)]">{tier}</span>
                <span>•</span>
                <span>entered the room</span>
              </div>
            </div>
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
    </>
  );
}

function EntranceChromakeyFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="entrance-green-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0.08" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="3.8" intercept="-0.08" />
          </feComponentTransfer>
        </filter>
        <filter id="entrance-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="5.2" intercept="-0.48" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

function EntranceVideoLayer({ url, chromakey, onEnded }: { url: string; chromakey: string; onEnded: () => void }) {
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
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
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
      onEnded={onEnded}
      onError={() => {
        setFailed(true);
        onEnded();
      }}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ filter: shouldKey ? "url(#entrance-green-key)" : undefined }}
    />
  );
}
