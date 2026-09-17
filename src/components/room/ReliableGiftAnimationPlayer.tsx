import { useCallback, useEffect, useRef, useState } from "react";
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
  const [fallback, setFallback] = useState<string | null>(null);
  const [fallbackType, setFallbackType] = useState<"video" | "svga" | "image" | null>(null);
  const activeRef = useRef<GiftEvent | null>(null);
  const queueRef = useRef<GiftEvent[]>([]);
  const seenRef = useRef(new Set<string>());
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    clearTimer();
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setFallback(null);
    setFallbackType(null);
    setActive(next);
  }, [clearTimer]);

  const enqueue = useCallback((event: GiftEvent) => {
    if (!event.key || seenRef.current.has(event.key)) return;
    seenRef.current.add(event.key);
    if (seenRef.current.size > 500) seenRef.current.clear();
    if (activeRef.current) queueRef.current.push(event);
    else {
      activeRef.current = event;
      setFallback(null);
      setFallbackType(null);
      setActive(event);
    }
  }, []);

  useEffect(() => {
    const onGift = (event: Event) => {
      const detail = (event as CustomEvent<GiftEvent>).detail;
      if (!detail || typeof detail !== "object") return;
      enqueue(detail);
    };
    window.addEventListener("jalwa:gift-sent", onGift as EventListener);
    return () => window.removeEventListener("jalwa:gift-sent", onGift as EventListener);
  }, [enqueue]);

  useEffect(() => {
    if (!active) return;
    clearTimer();
    const cfg = normalizeRenderConfig(active.renderConfig ?? DEFAULT_GIFT_RENDER);
    const declared = Number(active.durationMs ?? 0);
    const duration = cfg.endMs != null
      ? Math.max(800, cfg.endMs)
      : Math.min(180000, Math.max(2500, declared || 12000) + cfg.holdMs);
    timerRef.current = window.setTimeout(finish, Math.max(0, cfg.delayMs) + duration + 400);
    return clearTimer;
  }, [active, clearTimer, finish]);

  useEffect(() => () => {
    clearTimer();
    activeRef.current = null;
    queueRef.current = [];
  }, [clearTimer]);

  useEffect(() => {
    if (!active) return;
    const primary = asUrl(active.giftClipUrl) ?? asUrl(active.giftImageUrl) ?? asUrl(active.giftIcon);
    if (primary) return;
    let cancelled = false;
    const candidates = giftAssetCandidates(active.giftName);
    (async () => {
      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate, { method: "HEAD", cache: "force-cache" });
          if (response.ok && !cancelled) {
            setFallback(candidate);
            setFallbackType(giftAssetType(candidate));
            return;
          }
        } catch {
          // Try the next canonical asset.
        }
      }
    })();
    return () => { cancelled = true; };
  }, [active?.key, active?.giftName, active?.giftClipUrl, active?.giftImageUrl, active?.giftIcon]);

  if (!active) return null;

  const cfg: GiftRenderConfig = normalizeRenderConfig(active.renderConfig ?? DEFAULT_GIFT_RENDER);
  const src = asUrl(active.giftClipUrl) ?? fallback;
  const kind = src ? (fallback && !active.giftClipUrl ? fallbackType ?? typeOf(src, active.giftClipType) : typeOf(src, active.giftClipType)) : "image";
  const stageStyle = renderConfigToStyle(cfg);
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: OBJECT_FIT[cfg.fit],
  };

  return (
    <div
      aria-live="polite"
      data-jalwa-gift-player="true"
      className="pointer-events-none fixed inset-0 z-[95] overflow-hidden"
      style={{ ...stageStyle, pointerEvents: "none" }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {kind === "video" && src ? (
          <GiftGLVideo
            key={`${active.key}:${src}`}
            src={src}
            config={cfg}
            loop={Boolean(cfg.loop && cfg.loopCount !== 1)}
            muted
            volume={0}
            className="h-full w-full"
            style={mediaStyle}
            objectFit={OBJECT_FIT[cfg.fit]}
            playbackKey={active.key}
            onEnded={finish}
            onError={() => {
              setFallback(null);
              setFallbackType(null);
              const next = giftAssetCandidates(active.giftName).find((candidate) => candidate !== src);
              if (next) {
                setFallback(next);
                setFallbackType(giftAssetType(next));
              } else {
                finish();
              }
            }}
            onDuration={(ms) => {
              clearTimer();
              if (cfg.endMs == null && ms > 0) timerRef.current = window.setTimeout(finish, ms + cfg.holdMs + 500);
            }}
          />
        ) : kind === "svga" && src ? (
          <SvgaPlayer
            src={src}
            loops={cfg.loop ? 0 : 1}
            clearsAfterStop={false}
            className="h-full w-full"
            style={mediaStyle}
            onFinished={finish}
          />
        ) : src ? (
          <img src={src} alt={active.giftName ?? active.giftEmoji ?? "Gift"} className="h-full w-full object-contain" style={mediaStyle} onError={finish} />
        ) : (
          <div className="text-7xl drop-shadow-2xl" aria-label={active.giftName ?? "Gift"}>{active.giftEmoji ?? "🎁"}</div>
        )}
      </div>
    </div>
  );
}
