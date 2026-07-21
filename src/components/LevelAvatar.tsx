import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { frameForLevel } from "@/lib/levelFrames";


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
  const ringUrl = resolveAssetUrl(ring);
  const frameIsVideo = !!frameUrl && /\.(mp4|webm|mov)($|\?)/i.test(frameUrl);
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


      {/* Inner disc */}
      <div className="absolute inset-0 z-[4] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40">
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

      {/* Equipped DP frame (or auto level-based frame) overlay */}
      {frameUrl && (
        <div
          className="pointer-events-none absolute inset-[-42%] z-[2] flex items-center justify-center"
          aria-hidden
        >


          {frameIsVideo ? (
            <video
              key={frameUrl}
              src={frameUrl}
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
            <img
              src={frameUrl}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          )}
        </div>
      )}
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
