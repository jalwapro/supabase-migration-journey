import { useEffect, useRef, useState } from "react";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { isVideoUrl } from "@/hooks/useVipFrameAssets";
import { cn } from "@/lib/utils";

/** Renders an image or looping video asset. Off-screen videos are paused to
 * avoid continuous decoder/GPU work while scrolling or when cards are hidden. */
export function FramedMedia({ url, className, fit = "cover", removeBlackBackground = false }: { url: string | null | undefined; className?: string; fit?: "cover" | "fill" | "contain"; removeBlackBackground?: boolean }) {
  const src = resolveAssetUrl(url);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isVideoUrl(src) || !videoRef.current) return;
    const video = videoRef.current;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0),
      { rootMargin: "120px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (visible) {
      void videoRef.current.play().catch(() => undefined);
    } else {
      videoRef.current.pause();
    }
  }, [visible]);

  if (!src) return null;
  const cls = cn("pointer-events-none h-full w-full", fit === "cover" ? "object-cover" : fit === "fill" ? "object-fill" : "object-contain", removeBlackBackground && "mix-blend-screen", className);
  return isVideoUrl(src)
    ? <video ref={videoRef} src={src} autoPlay={visible} loop muted playsInline preload={visible ? "metadata" : "none"} className={cls} />
    : <img src={src} alt="" draggable={false} className={cls} loading="lazy" decoding="async" />;
}
