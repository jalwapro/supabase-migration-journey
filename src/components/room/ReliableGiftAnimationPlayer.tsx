import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GiftGLVideo from "@/components/room/GiftGLVideo";
import SvgaPlayer from "@/components/room/SvgaPlayer";
import {
  DEFAULT_GIFT_RENDER,
  normalizeRenderConfig,
  renderConfigToStyle,
  OBJECT_FIT,
  type GiftRenderConfig,
} from "@/lib/giftRender";
import { giftAssetCandidates, giftAssetType } from "@/lib/giftAssetResolver";
import { resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";

type GiftEvent = {
  key: string;
  giftId?: string;
  giftName?: string;
  giftEmoji?: string;
  giftIcon?: string | null;
  giftImageUrl?: string | null;
  giftClipUrl?: string | null;
  giftClipType?: string | null;
  durationMs?: number | null;
  quantity?: number;
  soundUrl?: string | null;
  audioEnabled?: boolean | null;
  audioVolume?: number | null;
  renderConfig?: Record<string, unknown> | null;
};

const asUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (s.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${s}`;
  if (s.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${s}`;
  return s;
};

const typeOf = (src: string, declared?: string | null) => {
  const t = (declared ?? "").toLowerCase();
  if (["mp4", "webm", "mov"].includes(t)) return "video" as const;
  if (t === "svga") return "svga" as const;
  return giftAssetType(src);
};

export function ReliableGiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftEvent | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [resolvedType, setResolvedType] = useState<"video" | "svga" | "image" | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const activeRef = useRef<GiftEvent | null>(null);
  const queueRef = useRef<GiftEvent[]>([]);
  const seenRef = useRef(new Set<string>());
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clearTimer = useCallback(() => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); timerRef.current = null; }, []);
  const stopAudio = useCallback(() => { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; audioRef.current = null; } }, []);
  const finish = useCallback(() => { clearTimer(); stopAudio(); const next = queueRef.current.shift() ?? null; activeRef.current = next; setResolvedSrc(null); setResolvedType(null); setCandidateIndex(0); setCandidates([]); setActive(next); }, [clearTimer, stopAudio]);
  const enqueue = useCallback((event: GiftEvent) => { if (!event.key || seenRef.current.has(event.key)) return; seenRef.current.add(event.key); if (seenRef.current.size > 500) seenRef.current.clear(); if (activeRef.current) queueRef.current.push(event); else { activeRef.current = event; setResolvedSrc(null); setResolvedType(null); setCandidateIndex(0); setCandidates([]); setActive(event); } }, []);
  useEffect(() => { const onGift = (event: Event) => { const detail = (event as CustomEvent<GiftEvent>).detail; if (!detail || typeof detail !== "object") return; enqueue(detail); }; window.addEventListener("jalwa:gift-sent", onGift as EventListener); return () => window.removeEventListener("jalwa:gift-sent", onGift as EventListener); }, [enqueue]);
  useEffect(() => () => { clearTimer(); stopAudio(); activeRef.current = null; queueRef.current = []; }, [clearTimer, stopAudio]);
  useEffect(() => { if (!active) return; const direct = [asUrl(active.giftClipUrl), resolveGiftImageUrl(asUrl(active.giftImageUrl)), resolveGiftImageUrl(asUrl(active.giftIcon))].filter((x): x is string => Boolean(x)); const canonical = giftAssetCandidates(active.giftName).map(asUrl).filter((x): x is string => Boolean(x)); const unique = [...new Set([...direct, ...canonical])]; setCandidates(unique); setCandidateIndex(0); const first = unique[0] ?? null; setResolvedSrc(first); setResolvedType(first ? typeOf(first, active.giftClipType) : null); }, [active?.key, active?.giftName, active?.giftClipUrl, active?.giftImageUrl, active?.giftIcon, active?.giftClipType]);
  useEffect(() => { if (!active) return; setPlaybackStarted(false); clearTimer(); const cfg = normalizeRenderConfig(active.renderConfig ?? DEFAULT_GIFT_RENDER); const declared = Number(active.durationMs ?? 0); const duration = cfg.endMs != null ? Math.max(800, cfg.endMs) : Math.min(180000, Math.max(2500, declared || 12000) + cfg.holdMs); timerRef.current = window.setTimeout(finish, Math.max(0, cfg.delayMs) + duration + 400); return clearTimer; }, [active, clearTimer, finish]);
  useEffect(() => { if (!active || !playbackStarted) return; stopAudio(); const enabled = active.audioEnabled !== false; const src = asUrl(active.soundUrl); if (!enabled || !src || typeof window === "undefined") return; const volumeValue = Number(active.audioVolume ?? 1); const volume = Number.isFinite(volumeValue) ? Math.min(1, Math.max(0, volumeValue)) : 1; const audio = new Audio(src); audio.preload = "auto"; audio.volume = volume; audioRef.current = audio; void audio.play().catch(() => {}); return stopAudio; }, [active?.key, active?.soundUrl, active?.audioEnabled, active?.audioVolume, stopAudio]);
  if (!active) return null;
  const cfg: GiftRenderConfig = normalizeRenderConfig(active.renderConfig ?? DEFAULT_GIFT_RENDER);
  const src = resolvedSrc;
  const kind = src ? resolvedType ?? typeOf(src, active.giftClipType) : "image";
  if (!playbackStarted) {
    return <div aria-live="polite" data-jalwa-gift-player="true" className="pointer-events-none fixed inset-0 z-[99999]" style={{ width: "100vw", height: "100dvh" }} />;
  }
  const stageStyle = renderConfigToStyle(cfg);
  const mediaStyle: React.CSSProperties = { width: "100%", height: "100%", display: "block", objectFit: OBJECT_FIT[cfg.fit] };
  const advanceCandidate = () => { const nextIndex = candidateIndex + 1; if (nextIndex >= candidates.length) { setResolvedSrc(null); setResolvedType(null); return; } const next = candidates[nextIndex]!; setCandidateIndex(nextIndex); setResolvedSrc(next); setResolvedType(typeOf(next, null)); };
  return (
    <div aria-live="polite" data-jalwa-gift-player="true" className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden" style={{ pointerEvents: "none", width: "100vw", height: "100dvh", left: 0, top: 0 }}>
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ width: "100%", height: "100%", left: 0, top: 0 }}>
        <div className="relative flex items-center justify-center" style={{ ...stageStyle, margin: "auto", flexShrink: 0, transformOrigin: "center center" }}>
          {kind === "video" && src ? (
            <GiftGLVideo key={`${active.key}:${src}`} src={src} config={cfg} muted={active.audioEnabled !== false && Boolean(active.soundUrl)} volume={active.audioEnabled === false ? 0 : Number(active.audioVolume ?? 1)} loop={Boolean(cfg.loop && cfg.loopCount !== 1)} className="h-full w-full" style={mediaStyle} objectFit={OBJECT_FIT[cfg.fit]} playbackKey={active.key} onEnded={() => { if (cfg.holdMs > 0) window.setTimeout(finish, cfg.holdMs + 400); else finish(); }} onError={advanceCandidate} onDuration={(ms) => { clearTimer(); if (cfg.endMs == null && ms > 0) timerRef.current = window.setTimeout(finish, ms + cfg.holdMs + 500); }} />
          ) : kind === "svga" && src ? (
            <SvgaPlayer key={`${active.key}:${src}`} src={src} loops={cfg.loop ? 0 : 1} clearsAfterStop={false} className="h-full w-full" style={mediaStyle} onFinished={finish} />
          ) : src ? (
            <img key={`${active.key}:${src}`} src={src} alt={active.giftName ?? active.giftEmoji ?? "Gift"} className="h-full w-full object-contain" style={mediaStyle} onError={advanceCandidate} />
          ) : (
            <div className="text-7xl drop-shadow-2xl" aria-label={active.giftName ?? "Gift"}>{active.giftEmoji ?? "🎁"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
