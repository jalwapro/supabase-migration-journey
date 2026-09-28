import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { frameForLevel } from "@/lib/levelFrames";
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
  const renderConfig = (shopFrameConfig ?? []).find((t) =>
    [t.animation_url, t.preview_url, t.bg_image].some((u) => (u ?? "").split("#")[0] === baseFrame)
  )?.render_config as Record<string, unknown> | undefined;
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
  const frameScale = Number(renderConfig?.scale ?? 1) * Number(renderConfig?.scaleX ?? 1) * Number(renderConfig?.scaleY ?? 1) * Number(renderConfig?.zoom ?? 1);
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
      className={`relative block shrink-0 ${userId ? "cursor-pointer" : ""} ${className}`}
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
        const overlayPx = (TARGET_FRAME_RATIO * px) / calib.fill;
        // Shift so visible content centre lands on the avatar centre.
        const shiftY = (0.5 - calib.cy) * overlayPx;
        return (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[2] flex items-center justify-center"
            style={{
              width: overlayPx,
              height: overlayPx,
              transform: `translate(calc(-50% + ${frameX}%), calc(-50% + ${shiftY}px + ${frameY}%)) rotate(${frameRotation}deg) scale(${frameScale})`,
              opacity: frameOpacity,
              filter: frameFilter || undefined,
            }}
            aria-hidden
          >
            {frameMeta && frameIsVideo ? (
              <ChromaKeyVideo src={cleanFrameUrl!} chromakey="custom" color={frameMeta.color} tolerance={frameMeta.tolerance} softness={frameMeta.softness} />
            ) : frameMeta ? (
              <ChromaKeyImage src={cleanFrameUrl!} color={frameMeta.color} tolerance={frameMeta.tolerance} softness={frameMeta.softness} />
            ) : frameIsVideo ? (
              <video key={cleanFrameUrl} src={cleanFrameUrl} autoPlay muted loop playsInline preload="auto" className="h-full w-full object-contain" style={{ backgroundColor: "transparent", objectPosition: "center" }} onLoadedData={(event) => event.currentTarget.play().catch(() => undefined)} />
            ) : (
              <img src={cleanFrameUrl} alt="" className="h-full w-full object-contain" style={{ objectPosition: "center" }} draggable={false} />
            )}
          </div>
        );
      })()}
      {frameUrl && (
        <span className="pointer-events-none absolute inset-[-30%] z-[6]" aria-hidden>
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
