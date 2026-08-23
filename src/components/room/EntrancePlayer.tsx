import React, { useEffect, useRef, useState } from "react";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";
import { shouldSkipHeavyEffects } from "@/lib/entrance/registry";

/** Equipped video => slide above header + video in header/footer stage.
 * No equipped video => slow slide directly above chat. */
export function EntrancePlayer({ event, onDone }: { event: RoomEntranceEvent; onDone: () => void }) {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visible, setVisible] = useState(true);
  onDoneRef.current = onDone;

  const hasVideo = !!event.media_url && !!event.media_type && ["mp4", "webm", "lottie", "svga", "svg"].includes(event.media_type);
  const duration = Math.min(Math.max(event.duration_ms ?? 2400, 1800), 6500);
  const level = Math.max(0, Number(event.vip_level ?? 0));
  const tier = level >= 100 ? "LEGEND" : level >= 50 ? "DIAMOND" : level >= 25 ? "PLATINUM" : level >= 10 ? "GOLD" : "VIP";
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDoneRef.current(); };

  useEffect(() => {
    doneRef.current = false;
    setVisible(true);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 1100 : shouldSkipHeavyEffects() && hasVideo ? Math.min(duration, 2200) : duration;
    const hide = window.setTimeout(() => setVisible(false), Math.max(0, total - 350));
    const done = window.setTimeout(finish, total);
    if (event.sound_url && hasVideo) {
      try { const audio = new Audio(event.sound_url); audio.volume = 0.7; audioRef.current = audio; void audio.play().catch(() => undefined); } catch {}
    }
    return () => { window.clearTimeout(hide); window.clearTimeout(done); audioRef.current?.pause(); audioRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, duration, event.sound_url, hasVideo]);

  return <>
    {hasVideo && event.media_url ? <div className={`pointer-events-none fixed inset-x-0 top-[58px] bottom-[62px] z-[998] flex justify-center overflow-hidden transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden>
      <div className="relative h-full w-full max-w-[480px] overflow-hidden">
        {event.media_url.startsWith("builtin:") ? <BuiltinEntranceView mediaUrl={event.media_url} /> : event.media_type === "mp4" || event.media_type === "webm" ? <EntranceVideoLayer url={event.media_url} onEnded={finish} /> : <img src={event.media_url} alt="" className="h-full w-full object-contain" />}
      </div>
    </div> : null}

    <div className={`pointer-events-none fixed left-0 right-0 z-[999] flex justify-center px-2 transition-all duration-[900ms] ease-out ${visible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`} style={hasVideo ? { top: "8px" } : { bottom: "calc(clamp(52px, 7dvh, 62px) + clamp(160px, 27dvh, 220px) + 8px)" }} aria-hidden>
      <div className="w-full max-w-[480px]">
        <div className="mx-auto flex h-[42px] w-fit max-w-[96%] items-center gap-2 overflow-hidden rounded-full border border-white/25 bg-black/85 px-2.5 py-1.5 shadow-[0_7px_28px_rgba(0,0,0,.48)] backdrop-blur-xl">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--primary)] bg-black/50">
            {event.avatar_url ? <img src={event.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] font-black text-white">{(event.username ?? "G").slice(0, 1).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 max-w-[235px] text-left leading-none">
            <div className="flex items-center gap-1.5"><span className="max-w-[150px] truncate text-[11px] font-black text-white">{event.username ?? "Guest"}</span><span className="rounded-full border border-[color:var(--primary)]/70 bg-[color:var(--primary)]/20 px-1.5 py-0.5 text-[7px] font-black tracking-wider text-white">LV {level}</span></div>
            <div className="mt-1 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-white/65"><span className="text-[color:var(--primary)]">{tier}</span><span>•</span><span>entered the room</span></div>
          </div>
        </div>
      </div>
    </div>
  </>;
}

function EntranceVideoLayer({ url, onEnded }: { url: string; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <video ref={ref} src={url} autoPlay muted playsInline preload="auto" onLoadedData={() => void ref.current?.play().catch(() => undefined)} onEnded={onEnded} onError={() => { setFailed(true); onEnded(); }} className="h-full w-full object-contain" />;
}
