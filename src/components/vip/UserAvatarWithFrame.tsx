import { LevelAvatar } from "@/components/LevelAvatar";
import { useVipFrameAssets, resolveVipAssets, useVipTierAssets } from "@/hooks/useVipFrameAssets";

type Size = "sm" | "md" | "lg" | "xl";

/**
 * DP with the user's VIP-tier frame. With `userId`, admin overrides and the
 * live level are honoured; otherwise `vipLevel` decides the frame.
 */
export function UserAvatarWithFrame({
  avatarUrl, vipLevel, size = "md", userId, name, frameOverride, className,
}: {
  avatarUrl?: string | null;
  vipLevel: number;
  size?: Size;
  userId?: string | null;
  name?: string | null;
  frameOverride?: string | null;
  className?: string;
}) {
  const live = useVipFrameAssets(userId, vipLevel);
  const tiers = useVipTierAssets();
  const assets = userId ? live.assets : resolveVipAssets(tiers.data ?? [], vipLevel);
  return (
    <LevelAvatar
      src={avatarUrl}
      name={name}
      level={assets.level}
      size={size}
      userId={userId ?? undefined}
      frame={frameOverride ?? assets.dpFrameUrl}
      className={className}
    />
  );
}
