import { resolveAssetUrl } from "@/lib/assetUrl";
import { isVideoUrl } from "@/hooks/useVipFrameAssets";
import { cn } from "@/lib/utils";

/** Renders an image or looping video asset filling its parent. */
export function FramedMedia({ url, className, fit = "cover" }: { url: string | null | undefined; className?: string; fit?: "cover" | "fill" | "contain" }) {
  const src = resolveAssetUrl(url);
  if (!src) return null;
  const cls = cn("pointer-events-none h-full w-full", fit === "cover" ? "object-cover" : fit === "fill" ? "object-fill" : "object-contain", className);
  return isVideoUrl(src)
    ? <video src={src} autoPlay loop muted playsInline className={cls} />
    : <img src={src} alt="" draggable={false} className={cls} />;
}
