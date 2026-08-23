import React, { useEffect, useRef, useState } from "react";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";
import { shouldSkipHeavyEffects } from "@/lib/entrance/registry";

export function EntrancePlayer({ event, onDone }: { event: RoomEntranceEvent; onDone: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const [visible, setVisible] = useState(true);
  onDoneRef.current = onDone;
  const duration = Math.min(Math.max(event.duration_ms ?? 2500, 1200), 6000);
  const level = Math.max(0, Number(event.vip_level ?? 0));
  const tier = level >= 100 ? "LEGEND" : level >= 50 ? "DIAMOND" : level >= 25 ? "PLATINUM" : level >= 10 ? "GOLD" : "VIP";
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDoneRef.current(); };

  useEffect(() => {
    doneRef.current = false;
    setVisible(true);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const skipHeavy = shouldSkipHeavyEffects();
    const total = reduce || skipHeavy ? 900 : duration;
    const t1 = window.setTimeout(() => setVisible(false), Math.max(0, total - 250));
    const t2 = window.setTimeout(finish, total);
    if (event.sound_url) { try { const a = new Audio(event.sound_url); a.volume = 0.7; audioRef.current = a; void a.play().catch(() => undefined); } catch {} }
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); audioRef.current?.pause(); audioRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, duration, event.sound_url]);

  const mediaType = event.media_type ?? "svg";
  const url = event.media_url ?? "";
  const isVideo = mediaType === "mp4" || mediaType === "webm";
  const hasEffect = url.length > 0;

  return (
    <div className={`pointer-events-none fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden>
      {hasEffect && <div className="absolute inset-0 bg-black/35" />}
      <div className="absolute inset-0 mx-auto max-w-[480px]">
        {url.startsWith("builtin:") ? <BuiltinEntranceView mediaUrl={url} /> : isVideo ? <EntranceVideoLayer url={url} chromakey={event.chromakey ?? "green"} onEnded={finish} /> : <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: event.chromakey === "green" || event.chromakey === "luma" || event.chromakey === "black" ? "url(#entrance-green-key)" : undefined }} />}
        <EntranceChromakeyFilters />
      </div>

      <div className={`relative z-10 mx-auto w-full max-w-[480px] px-3 transition-all duration-500 ease-out ${visible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`}>
        <div className="mx-auto flex w-fit min-w-[210px] items-center gap-2 rounded-2xl border border-white/20 bg-black/75 px-3 py-2 shadow-2xl backdrop-blur-md">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--primary)] bg-black/40">
            {event.avatar_url ? <img src={event.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-black text-white">{(event.username ?? "G").slice(0, 1).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="max-w-[150px] truncate text-[12px] font-black text-white">{event.username ?? "Guest"}</span>
              <span className="rounded-full border border-[color:var(--primary)]/70 bg-[color:var(--primary)]/20 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white">LV {level}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-white/65">
              <span className="text-[color:var(--primary)]">{tier}</span><span>•</span><span>entered the room</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes entrance-scale { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

function EntranceChromakeyFilters() {
  return <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}><defs><filter id="entrance-green-key" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0.08" /><feComponentTransfer><feFuncA type="linear" slope="3.8" intercept="-0.08" /></feComponentTransfer></filter><filter id="entrance-luma-key" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" /><feComponentTransfer><feFuncA type="linear" slope="5.2" intercept="-0.48" /></feComponentTransfer></filter></defs></svg>;
}

function EntranceVideoLayer({ url, chromakey, onEnded }: { url: string; chromakey: string; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [detected, setDetected] = useState<"green" | "luma" | "none" | null>(null);
  const [failed, setFailed] = useState(false);
  const detect = () => { const video = ref.current; if (!video || !video.videoWidth || detected !== null) return; try { const w = 48; const h = Math.max(8, Math.round((video.videoHeight / video.videoWidth) * w)); const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return; ctx.drawImage(video, 0, 0, w, h); const data = ctx.getImageData(0, 0, w, h).data; const pts: Array<[number, number]> = []; for (let x = 0; x < w; x++) pts.push([x, 0], [x, h - 1]); for (let y = 0; y < h; y++) pts.push([0, y], [w - 1, y]); let green = 0; let dark = 0; for (const [x, y] of pts) { const i = (y * w + x) * 4; const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]; if (a < 24) continue; if (g > 70 && g > r * 1.35 && g > b * 1.35) green++; else if (r + g + b < 96) dark++; } setDetected(green / pts.length > 0.35 ? "green" : dark / pts.length > 0.55 ? "luma" : "none"); } catch { setDetected(null); } };
  useEffect(() => { setDetected(null); setFailed(false); }, [url]);
  if (failed) return null;
  const meta = chromakey === "green" || chromakey === "luma" || chromakey === "black";
  const shouldKey = detected ? detected !== "none" : meta;
  return <video ref={ref} src={url} autoPlay muted playsInline preload="auto" onLoadedData={() => { detect(); void ref.current?.play().catch(() => undefined); }} onEnded={onEnded} onError={() => { setFailed(true); onEnded(); }} className="absolute inset-0 h-full w-full object-cover" style={{ filter: shouldKey ? "url(#entrance-green-key)" : undefined }} />;
}
