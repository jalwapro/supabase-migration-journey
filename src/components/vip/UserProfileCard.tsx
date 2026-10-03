import type { ReactNode } from "react";
import { Crown } from "lucide-react";
import { UserAvatarWithFrame } from "./UserAvatarWithFrame";
import { FramedMedia } from "./FramedMedia";
import type { VipFrameAssets } from "@/hooks/useVipFrameAssets";
import { useVipFrameAssets } from "@/hooks/useVipFrameAssets";

export type ProfileCardUser = {
  id: string;
  name: string | null;
  code?: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  followers?: number;
  following?: number;
  vipLevel: number;
};

/** VIP-tier styled profile card. Pass `assetsOverride` for admin live preview. */
export function UserProfileCard({ user, assetsOverride, children }: { user: ProfileCardUser; assetsOverride?: VipFrameAssets; children?: ReactNode }) {
  const live = useVipFrameAssets(assetsOverride ? null : user.id, user.vipLevel);
  const a = assetsOverride ?? live.assets;
  return (
    <div
      className="relative overflow-hidden rounded-3xl border-2 bg-card p-4 transition-all duration-300"
      style={{ borderColor: a.color, boxShadow: `0 0 24px -6px ${a.color}` }}
    >
      {a.cardBgUrl && <div className="absolute inset-0 opacity-70"><FramedMedia url={a.cardBgUrl} /></div>}
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background/85" />
      <div className="relative flex flex-col items-center text-center">
        <UserAvatarWithFrame avatarUrl={user.avatarUrl} name={user.name} vipLevel={a.level} size="xl" frameOverride={a.dpFrameUrl} profileCardFrameBlend />
        <p className="mt-3 text-lg font-black" style={{ color: a.color }}>{user.name ?? "User"}</p>
        {user.code && <p className="text-[11px] text-muted-foreground">ID: {user.code}</p>}
        <span
          className="mt-2 inline-flex animate-pulse items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ borderColor: a.color, color: a.color }}
        >
          <Crown className="h-3 w-3" /> VIP {a.level} · {a.title}
        </span>
        <div className="mt-3 flex gap-6 text-sm">
          <div><p className="font-black">{(user.followers ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Followers</p></div>
          <div><p className="font-black">{(user.following ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Following</p></div>
        </div>
        {user.bio && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{user.bio}</p>}
        {children}
      </div>
    </div>
  );
}
