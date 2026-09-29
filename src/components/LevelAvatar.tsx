import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { frameForLevel } from "@/lib/levelFrames";
import { normalizeRenderConfig } from "@/lib/giftRender";
import { calibForLevel, DEFAULT_FRAME_CALIB } from "@/lib/frameCalibration";
import { ChromaKeyVideo, ChromaKeyImage } from "@/components/ChromaKeyVideo";

// Every equipped/auto DP frame is normalised so the visible ring is exactly
// TARGET_FRAME_RATIO × avatar diameter, centred perfectly on the avatar disc.
// This is what keeps frame sizes/positions identical across every screen
// (home, rank podium, me, profile, room seats, admin, settings, …).
const TARGET_FRAME_RATIO = 1.55;



type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 40, md: 56, lg: 80, xl: 112 };

export function LevelAvatar({
  src,
  name,
  level,
  size = "md",
  showBadge = true,
  frame,
  ring,
  className = "",
  userId,
  renderConfigOverride,
}: {

  src?: string | null;
  name?: string | null;
  level: number;
  size?: Size;
  showBadge?: boolean;
  /** Equipped DP frame media URL (image / gif / webp / mp4). Renders a sparkling overlay around the avatar. */
  frame?: string | null;
  /** Equipped aura ring media URL. Rotates behind the avatar. */
  ring?: string | null;
  className?: string;
  /** If provided, avatar becomes a Link to that user's profile. */
  userId?: string | null;
  /** Persisted per-profile Shop Render Studio config; takes precedence over asset lookup. */
  renderConfigOverride?: unknown;
}) {

  const tier = tierForLevel(level);
  const px = SIZE_PX[size];
  const initial = (name ?? "J").slice(0, 1).toUpperCase();
  // If the user has an equipped shop frame, use it. Otherwise auto-apply the
  // VIP level frame so every profile shows a frame matching its current level.
  const autoFrame = frameForLevel(level);
  const effectiveFrame = frame ?? autoFrame;
  const frameUrl = resolveAssetUrl(effectiveFrame);
  const { data: shopFrameConfig } = useQuery({
    queryKey: ["shop-frame-render-configs"],
    enabled: !!frame && effectiveFrame !== autoFrame,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("themes").select("animation_url,preview_url,bg_image,render_config");
      if (error) throw error;
      return data ?? [];
    },
  });
  const baseFrame = (effectiveFrame ?? "").split("#")[0];
  const rawRenderConfig = (shopFrameConfig ?? []).find((t) =>
    [t.animation_url, t.preview_url, t.bg_image].some((u) => (u ?? "").split("#")[0] === baseFrame)
  )?.render_config;
  const renderConfig = normalizeRenderConfig(renderConfigOverride ?? rawRenderConfig) as unknown as Record<string, unknown>;
  const ringUrl = resolveAssetUrl(ring);
  const frameMeta = (() => {
    try {
      const u = new URL(effectiveFrame ?? "", window.location.href);
      const hash = u.hash.startsWith("#jalwa-chroma=") ? u.hash.slice("#jalwa-chroma=".length) : "";
      if (!hash) return null;
      const p = new URLSearchParams(hash);
      const color = p.get("color") ?? hash.split("&")[0];
      return color ? { color: `#${color.replace("#", "")}`, tolerance: Number(p.get("t")) || 48, softness: Number(p.get("s")) || 12 } : null;
    } catch { return null; }
  })();
  const cleanFrameUrl = frameUrl ? frameUrl.split("#")[0] : frameUrl;

  // Shop Render Studio is the single source of truth for an equipped frame.
  // Support both the persisted studio config and the legacy URL chroma hash.
  const studioChroma = (() => {
    if (!renderConfig) return null;
    const mode = String(renderConfig.chromaMode ?? "off");
    if (mode === "off") return null;
    const color = String(renderConfig.keyColor ?? (mode === "green" ? "#00ff00" : mode === "black" ? "#000000" : mode === "white" ? "#ffffff" : "#00aaff"));
    return {
      color,
      tolerance: Number(renderConfig.greenTolerance ?? 48),
      softness: Number(renderConfig.edgeSoftness ?? 12),
    };
  })();
  const effectiveChroma = studioChroma ?? frameMeta;
  const frameScale = Number(renderConfig?.scale ?? 1) * Number(renderConfig?.zoom ?? 1);
  const frameScaleX = frameScale * Number(renderConfig?.scaleX ?? 1);
  const frameScaleY = frameScale * Number(renderConfig?.scaleY ?? 1);
  const positionUnit = String(renderConfig?.positionUnit ?? "percent");
  const frameX = Number(renderConfig?.positionX ?? 0);
  const frameY = Number(renderConfig?.positionY ?? 0);
  const frameRotation = Number(renderConfig?.rotation ?? 0);
  const frameOpacity = Number(renderConfig?.opacity ?? 100) / 100;
  const frameFilter = [
    renderConfig?.brightness !== undefined ? `brightness(${1 + Number(renderConfig.brightness) / 100})` : "",
    renderConfig?.contrast !== undefined ? `contrast(${1 + Number(renderConfig.contrast) / 100})` : "",
    renderConfig?.saturation !== undefined ? `saturate(${Number(renderConfig.saturation)})` : "",
    renderConfig?.hue !== undefined ? `hue-rotate(${Number(renderConfig.hue)}deg)` : "",
  ].filter(Boolean).join(" ");
  const frameIsVideo = !!cleanFrameUrl && /\.(mp4|webm|mov)($|\?)/i.test(cleanFrameUrl);
  const ringIsVideo = !!ringUrl && /\.(mp4|webm|mov)($|\?)/i.test(ringUrl);

  const Wrapper: any = userId ? Link : "div";
  const wrapperProps: any = userId
    ? {
        to: "/u/$userId",
        params: { userId },
        onClick: (e: any) => e.stopPropagation(),
        "aria-label": `Open ${name ?? "user"} profile`,
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`relative z-0 block shrink-0 ${userId ? "cursor-pointer" : ""} ${className}`}
      style={{ width: px, height: px }}
    >

      {/* Equipped aura ring behind avatar */}
      {ringUrl && (
        <div className="pointer-events-none absolute inset-[-28%] z-0" aria-hidden>
          {ringIsVideo ? (
            <video
              key={ringUrl}
              src={ringUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="h-full w-full object-contain"
              style={{ backgroundColor: "transparent" }}
              onLoadedData={(event) => event.currentTarget.play().catch(() => undefined)}
            />
          ) : (
            <img src={ringUrl} alt="" className="h-full w-full object-contain" draggable={false} />
          )}
        </div>
      )}
      {/* Tier ring — only when no frame is present (frame already indicates level) */}
      {!frameUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-6%] z-[1] rounded-full"
          style={{
            padding: 2,
            background: `conic-gradient(from 0deg, ${tier.color}, #fff2, ${tier.color})`,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow: `0 0 12px ${tier.glow}`,
          }}
        />
      )}


      {/* Inner disc — sits BEHIND the frame overlay (z-[2]) so the frame's
          ornaments always paint on top of the photo. */}
      <div className="absolute inset-0 z-[1] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40">

        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/90">
            {name ? (
              <span className="text-lg font-black">{initial}</span>
            ) : (
              <UserIcon className="h-1/2 w-1/2 opacity-80" />
            )}
          </div>
        )}
      </div>

      {/* Equipped DP frame (or auto level-based frame) overlay — normalised */}
      {frameUrl && (() => {
        // If the frame is the auto level frame, we have exact calibration.
        // Custom shop frames fall back to a sane default.
        const calib = effectiveFrame === autoFrame ? calibForLevel(level) : DEFAULT_FRAME_CALIB;
        const calibratedRatio = (TARGET_FRAME_RATIO / Math.max(calib.fill, 0.1));
        // Shop Render Studio is stage-based; the profile renderer converts that
        // stage transform into avatar-relative units so the same saved config
        // survives every DP size and every page.
        // A VoiceRoom DP is a square avatar, not the 340x604 Render Studio
        // playback stage. The previous conversion used the full studio HEIGHT
        // as frame height, making a 40px seat frame render roughly 4-5x too tall.
        // For profile/room DPs, the frame is sized relative to the avatar and
        // the Studio width/height are used only to preserve the asset aspect.
        const studioWidth = Number(renderConfig.width ?? 0);
        const studioHeight = Number(renderConfig.height ?? 0);
        const STUDIO_STAGE_W = 340;
    const STUDIO_STAGE_H = 604;
    const configuredAspect = studioWidth > 0 && studioHeight > 0
          ? studioWidth / studioHeight
          : 1;
        const baseSize = px * TARGET_FRAME_RATIO * calibratedRatio * frameScale;
        const aspectRoot = Math.sqrt(Math.max(configuredAspect, 0.25));
        let overlayW = baseSize * aspectRoot;
        let overlayH = baseSize / aspectRoot;
        // Keep decorative frames close to the DP; never allow Studio canvas
        // dimensions to turn a small VoiceRoom seat into a giant overlay.
        const maxDim = px * 2.1;
        const maxOverlay = Math.max(overlayW, overlayH);
        if (maxOverlay > maxDim) {
          const ratio = maxDim / maxOverlay;
          overlayW *= ratio;
          overlayH *= ratio;
        }
        // Professional DP layout: keep the frame visually attached to the
        // avatar and reserve the entire lower edge for the name/status row.
        // Studio Y is allowed, but it is clamped so the frame can never drift
        // below the avatar's bottom edge and cover text.
        const visualScaleY = frameScaleY / Math.max(frameScale, 0.001);
        const visualH = overlayH * visualScaleY;
        const autoBottomAlignY = (px - visualH) / 2;
        const baseShiftY = autoBottomAlignY + (0.5 - calib.cy) * visualH;
        const configuredX = Number(renderConfig.positionX ?? 0);
        const configuredY = Number(renderConfig.positionY ?? 0);
        const xOffset = positionUnit === "px" ? (configuredX / STUDIO_STAGE_W) * px : (configuredX / 100) * px;
        const rawYOffset = positionUnit === "px" ? (configuredY / STUDIO_STAGE_H) * px : (configuredY / 100) * px;
        const maxDown = Math.max(0, (px - visualH) / 2);
        const maxUp = Math.max(0, (px - visualH) / 2);
        const finalShiftY = Math.min(maxDown, Math.max(-maxUp, baseShiftY + rawYOffset));
        return (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[2] flex items-center justify-center"
            style={{
              width: overlayW,
              height: overlayH,
              transform: `translate(calc(-50% + ${xOffset}px), calc(-50% + ${finalShiftY}px)) rotate(${frameRotation}deg) scale(${frameScaleX / Math.max(frameScale, 0.001)}, ${frameScaleY / Math.max(frameScale, 0.001)})`,
              opacity: frameOpacity,
              filter: frameFilter || undefined,
            }}
            aria-hidden
          >
            {effectiveChroma && frameIsVideo ? (
              <ChromaKeyVideo src={cleanFrameUrl!} chromakey="custom" color={effectiveChroma.color} tolerance={effectiveChroma.tolerance} softness={effectiveChroma.softness} />
            ) : effectiveChroma ? (
              <ChromaKeyImage src={cleanFrameUrl!} color={effectiveChroma.color} tolerance={effectiveChroma.tolerance} softness={effectiveChroma.softness} />
            ) : frameIsVideo ? (
              <video key={cleanFrameUrl} src={cleanFrameUrl} autoPlay muted loop playsInline preload="auto" className="h-full w-full object-contain" style={{ backgroundColor: "transparent", objectPosition: "center", transform: `scaleX(${renderConfig?.flipH ? -1 : 1}) scaleY(${renderConfig?.flipV ? -1 : 1})` }} onLoadedData={(event) => event.currentTarget.play().catch(() => undefined)} />
            ) : (
              <img src={cleanFrameUrl} alt="" className="h-full w-full object-contain" style={{ objectPosition: "center", transform: `scaleX(${renderConfig?.flipH ? -1 : 1}) scaleY(${renderConfig?.flipV ? -1 : 1})` }} draggable={false} />
            )}
          </div>
        );
      })()}
      {frameUrl && (
        <span className="pointer-events-none absolute inset-[-8%] z-[3] overflow-hidden" aria-hidden>
          <span className="dp-sparkle dp-sparkle-a" />
          <span className="dp-sparkle dp-sparkle-b" />
          <span className="dp-sparkle dp-sparkle-c" />
          <span className="dp-sparkle dp-sparkle-d" />
        </span>
      )}


      {/* Level chip hidden — DP frame already indicates level */}

    </Wrapper>

  );
}

export default LevelAvatar;
