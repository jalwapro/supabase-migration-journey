import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  profileCardFrameBlend = false,
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
  /** Blend dark frame backgrounds into profile-card artwork. */
  profileCardFrameBlend?: boolean;
}) {

  const tier = tierForLevel(level);
  const rootRef = useRef<HTMLElement | null>(null);
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

  // Keep decorative frame/ring videos paused when this avatar is off-screen.
  // Home can render many avatars at once; decoding all of them continuously
  // wastes CPU and heats Android devices.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    if (!videos.length) return;
    const playVisible = (visible: boolean) => {
      for (const video of videos) {
        if (visible) void video.play().catch(() => undefined);
        else video.pause();
      }
    };
    if (typeof IntersectionObserver === "undefined") {
      playVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => playVisible(entry?.isIntersecting ?? true), { threshold: 0.01 });
    observer.observe(root);
    return () => {
      observer.disconnect();
      videos.forEach((video) => video.pause());
    };
  }, [ringUrl, cleanFrameUrl, frameIsVideo, ringIsVideo]);

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
      ref={rootRef}
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
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              style={{ backgroundColor: "transparent" }}

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


      {/* Inner DP disc stays centered inside a small safe-area so frame
          ornaments never crop the user's face/photo. The frame itself keeps
          its existing size and exact center alignment. */}
      <div
        className="absolute left-1/2 top-1/2 z-[1] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40"
        style={{ width: "90%", height: "90%", transform: "translate(-50%, -50%)" }}
      >

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
        // DP frame geometry is always avatar-centered. The avatar itself is
        // the source of truth: a square DP sits exactly in the center circle,
        // while the frame grows evenly on all four sides. Studio X/Y are not
        // allowed to move a DP frame away from that circle.
        const baseSize = px * TARGET_FRAME_RATIO * frameScale;
        const overlayW = baseSize;
        const overlayH = baseSize;
        const finalScaleX = frameScaleX / Math.max(frameScale, 0.001);
        const finalScaleY = frameScaleY / Math.max(frameScale, 0.001);
        return (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[2] flex items-center justify-center"
            style={{
              width: overlayW,
              height: overlayH,
              transform: `translate(-50%, -50%) rotate(${frameRotation}deg) scale(${finalScaleX}, ${finalScaleY})`,
              opacity: frameOpacity,
              filter: frameFilter || undefined,
              // Keep screen as a fallback for any residual dark pixels while
              // the profile-card chroma pass removes the baked-in black canvas.
              mixBlendMode: profileCardFrameBlend ? "screen" : undefined,
            }}
            aria-hidden
          >
            {effectiveChroma && frameIsVideo ? (
              <ChromaKeyVideo src={cleanFrameUrl!} chromakey="custom" color={effectiveChroma.color} tolerance={effectiveChroma.tolerance} softness={effectiveChroma.softness} />
            ) : effectiveChroma ? (
              <ChromaKeyImage src={cleanFrameUrl!} color={effectiveChroma.color} tolerance={effectiveChroma.tolerance} softness={effectiveChroma.softness} />
            ) : frameIsVideo ? (
              <video key={cleanFrameUrl} src={cleanFrameUrl} muted loop playsInline preload="metadata" className="h-full w-full object-contain" style={{ backgroundColor: "transparent", objectPosition: "center", transform: `scaleX(${renderConfig?.flipH ? -1 : 1}) scaleY(${renderConfig?.flipV ? -1 : 1})` }} onLoadedData={(event) => event.currentTarget.play().catch(() => undefined)} />
            ) : (
              <img src={cleanFrameUrl ?? undefined} alt="" className="h-full w-full object-contain" style={{ objectPosition: "center", transform: `scaleX(${renderConfig?.flipH ? -1 : 1}) scaleY(${renderConfig?.flipV ? -1 : 1})` }} draggable={false} />
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
