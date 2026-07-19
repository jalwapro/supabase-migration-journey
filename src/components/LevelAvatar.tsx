import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { frameForLevel, framesForLevelStack } from "@/lib/levelFrames";


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
  // Auto-assign frame(s) from level series if user has none equipped.
  // Stack every frame from the current series' first level up to the user's
  // current level so progression is visible on the avatar.
  const stackFrames = frame ? [] : framesForLevelStack(level);
  const effectiveFrame = frame ?? frameForLevel(level);
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
      {/* Gradient ring (static for mobile GPU stability) */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${tier.ringGradient}`}
        style={{
          boxShadow: `0 0 18px -2px ${tier.glow}`,
          maskImage: "radial-gradient(circle, transparent 58%, black 60%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 60%)",
        }}
      />
      {/* Inner disc */}
      <div className="absolute inset-[8%] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40">
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

      {/* Equipped DP frame overlay with sparkles.
          When no custom frame is equipped, stack every frame in the current
          10-level series up to the user's level so progression is visible. */}
      {frame && frameUrl && (
        <div
          className="pointer-events-none absolute inset-[-42%] z-[5]"
          style={{ transform: "translateY(-6%)" }}
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
      {!frame && stackFrames.map((item, idx) => {
        const url = resolveAssetUrl(item.url);
        if (!url) return null;
        const isVideo = /\.(mp4|webm|mov)($|\?)/i.test(url);
        return (
          <div
            key={item.level}
            className="pointer-events-none absolute inset-[-42%]"
            style={{ transform: "translateY(-6%)", zIndex: 5 + idx }}
            aria-hidden
          >
            {isVideo ? (
              <video
                src={url}
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
              <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
            )}
          </div>
        );
      })}
      {(frameUrl || stackFrames.length > 0) && (
        <span className="pointer-events-none absolute inset-[-22%] z-[20]" aria-hidden>
          <span className="dp-sparkle dp-sparkle-a" />
          <span className="dp-sparkle dp-sparkle-b" />
          <span className="dp-sparkle dp-sparkle-c" />
          <span className="dp-sparkle dp-sparkle-d" />
        </span>
      )}

      {/* Level chip */}
      {showBadge && (
        <span
          className={`absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r ${tier.gradient} px-2 py-[1px] text-[9px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-black/40`}
        >
          <span className="mr-0.5">{tier.icon}</span>
          Lv {level}
        </span>
      )}
    </Wrapper>

  );
}
