import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  Copy,
  ChevronRight,
  LogOut,
  Camera,
  Loader2,
  Pencil,
  Mic,
  Home,
  Swords,
  Gamepad2,
  ShoppingBag,
  Image as ImageIcon,
  Trophy,
  Wallet,
  Receipt,
  Gem,
  Palette,
  Bell,
  SlidersHorizontal,
  Users,
  UserX,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Star,
  Coins,
  Mail,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, type ComponentType } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LevelAvatar } from "@/components/LevelAvatar";
import { formatCompact } from "@/lib/utils";
import { VipRewardsGrid } from "@/components/vip/VipRewardsGrid";
import { useVipProfile } from "@/hooks/useVipProfile";
import { vipTierForLevel, vipProgressFor, formatCoins, MILESTONE_REWARDS } from "@/lib/vip-levels";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

const HEADING = { fontFamily: "'Archivo Black', system-ui, sans-serif" } as const;
const BODY = { fontFamily: "'Hind', system-ui, sans-serif" } as const;

function useCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["me-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId!),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
}

function MePage() {
  const { user, profile, isAdmin, signOut, refresh } = useAuth();
  const { data: counts } = useCounts(user?.id);
  const { data: vip } = useVipProfile(user?.id);
  const { data: partnerRow } = useQuery({
    queryKey: ["is-partner", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id,is_active,percentage")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const isPartner = !!partnerRow?.is_active;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const vipLevel = vip?.row.vip_level ?? 0;
  const tier = vipTierForLevel(vipLevel);
  const p = vipProgressFor(Number(vip?.row.total_gifted_coins ?? 0), vipLevel);
  const nextMilestone =
    Object.keys(MILESTONE_REWARDS).map(Number).sort((a, b) => a - b).find((lvl) => lvl > p.level) ?? 100;
  const reward = MILESTONE_REWARDS[nextMilestone];

  async function onPickAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar: publicUrl })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      toast.success("Profile photo updated ✨");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const userName = profile?.username ?? "you";
  const handleCopyId = () => {
    if (!profile?.user_code) return;
    navigator.clipboard.writeText(profile.user_code);
    toast.success("ID copied");
  };

  return (
    <>
      <AppShell title="" subtitle="">
        <div className="relative min-h-full overflow-hidden bg-[#0a0a0f] text-white" style={BODY}>
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 left-1/4 h-64 w-64 rounded-full bg-[#ff2d95]/15 blur-[100px]" />
            <div className="absolute top-40 -right-10 h-52 w-52 rounded-full bg-[#8b5cf6]/15 blur-[80px]" />
            <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,45,149,0.08),transparent_70%)]" />
          </div>

          <div className="relative z-10 flex flex-col">
            <div className="space-y-5 px-5 pb-3 pt-6">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl uppercase italic tracking-tighter text-white" style={HEADING}>
                  Profile
                </h1>
                <div className="flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff2d95] to-[#8b5cf6] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg"
                    style={HEADING}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/45 transition hover:text-white"
                    style={HEADING}
                  >
                    <LogOut className="h-3 w-3" /> Exit
                  </button>
                </div>
              </div>

              <div className="flex justify-between gap-1.5 rounded-2xl border border-white/5 bg-black/40 p-1.5">
                <StatCell to="/friends" icon={<Users className="h-3.5 w-3.5" />} value={counts?.followers ?? 0} label="Followers" />
                <StatCell to="/friends" icon={<Users className="h-3.5 w-3.5" />} value={counts?.following ?? 0} label="Following" />
                <StatCell to="/wallet" icon={<Coins className="h-3.5 w-3.5" />} value={profile?.coins ?? 0} label="Coins" />
                <StatCell to="/withdraw" icon={<Star className="h-3.5 w-3.5" />} value={profile?.diamonds ?? 0} label="Points" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <ProfileChip label={`@${userName.toLowerCase()}`} icon={BadgeCheck} />
                  {profile?.user_code && <ProfileChip label={`ID ${profile.user_code}`} icon={Copy} onClick={handleCopyId} />}
                  {user?.email && <ProfileChip label="Verified" icon={Mail} />}
                </div>
                <Link
                  to="/vip"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#fbbf24]/40 bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#fbbf24]"
                  style={HEADING}
                >
                  <Shield className="h-3 w-3" /> {tier.label}
                </Link>
              </div>
            </div>

            <div className="flex items-end justify-center gap-3 px-5 py-4">
              <ProfileSideCard label="Coins" value={profile?.coins ?? 0} icon={Coins} place={2} />
              <div className="flex-[1.2] -mt-6 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute -inset-4 animate-pulse rounded-full bg-[#ff2d95]/20 blur-2xl" />
                  <div className="relative rounded-3xl border-2 border-[#ff2d95] bg-white/10 p-2 shadow-[0_0_30px_rgba(255,45,149,0.3)] backdrop-blur-2xl">
                    <LevelAvatar
                      src={profile?.avatar}
                      name={profile?.username}
                      level={vipLevel}
                      size="xl"
                      showBadge
                      frame={profile?.frame}
                      ring={profile?.ring}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      aria-label="Change photo"
                      className="absolute -right-2 -top-2 grid h-10 w-10 place-items-center rounded-2xl border-2 border-[#0a0a0f] bg-[#ff2d95] text-white shadow-[0_4px_15px_rgba(255,45,149,0.5)] disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onPickAvatar(f);
                      }}
                    />
                    <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#0a0a0f] bg-[#ff2d95] px-4 py-1 text-sm text-white shadow-[0_4px_15px_rgba(255,45,149,0.5)]" style={HEADING}>
                      Lv {p.level}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="max-w-[190px] truncate text-lg uppercase italic leading-none tracking-tight text-white" style={HEADING}>
                    {userName}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#ff2d95]" style={HEADING}>
                    {formatCoins(p.totalGifted)} Gifted
                  </p>
                </div>
              </div>
              <ProfileSideCard label="Points" value={profile?.diamonds ?? 0} icon={Gem} place={3} />
            </div>

            <div className="rounded-t-[48px] border-t border-white/10 bg-black/60 p-5 pb-28 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <div
                className="relative mb-4 overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-4"
                style={{ boxShadow: `inset 0 0 40px -18px ${tier.glow}` }}
              >
                <div aria-hidden className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#ff2d95]/15 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#fbbf24]/35 bg-black/40 text-3xl shadow-[0_0_18px_rgba(251,191,36,0.15)]">
                    🛡️
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm uppercase text-white" style={HEADING}>{tier.label}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40" style={HEADING}>Lifetime Gift</p>
                      </div>
                      <Sheet>
                        <SheetTrigger asChild>
                          <button className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/75" style={HEADING}>
                            Rewards
                          </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0a0614] text-white">
                          <SheetHeader>
                            <SheetTitle className="text-white">Milestone Rewards</SheetTitle>
                          </SheetHeader>
                          <div className="mt-3">
                            <VipRewardsGrid currentLevel={vipLevel} />
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${p.percent}%`,
                          background: `linear-gradient(90deg, #ff2d95, #8b5cf6, #fbbf24)`,
                          boxShadow: `0 0 12px ${tier.glow}`,
                        }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <MiniStat label="Current" value={formatCoins(p.totalGifted - p.currentLevelStart)} />
                      <MiniStat label={p.isMax ? "Max" : "Next Lv"} value={p.isMax ? "MAX" : formatCoins(p.nextLevelAt)} />
                      <MiniStat label="Remain" value={p.isMax ? "0" : formatCoins(p.remaining)} />
                    </div>
                    {!p.isMax && reward && (
                      <div className="mt-3 rounded-2xl border border-[#fbbf24]/20 bg-black/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/40" style={HEADING}>Next milestone • Lv {nextMilestone}</p>
                        <p className="truncate text-xs font-bold text-white">{reward.bundle} <span className="text-[#fbbf24]">+{reward.coins.toLocaleString()} 🪙</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-4 gap-2">
                <Quick to="/create-room" icon={Mic} label="Live" color="#ff2d95" />
                <Quick to="/theme-shop" icon={ShoppingBag} label="Shop" color="#fbbf24" />
                <Quick to="/rank" icon={Trophy} label="Rank" color="#8b5cf6" />
                <Quick to="/games" icon={Gamepad2} label="Games" color="#22c55e" />
              </div>

              <div className="flex px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/30" style={HEADING}>
                <span className="w-10">No</span>
                <span className="flex-1">Profile Menu</span>
                <span className="text-right">Open</span>
              </div>

              <ul className="space-y-2.5">
                {isAdmin && <Tile index={1} to="/admin" icon={ShieldCheck} title="Admin Panel" sub="Manage the whole app" color="#fbbf24" elite />}
                {isPartner && <Tile index={2} to="/partner" icon={ShieldCheck} title="Partner" sub={`${partnerRow?.percentage ?? 0}% share`} color="#fbbf24" elite />}
                <Tile index={3} to="/gallery" icon={ImageIcon} title="Gallery" sub="Manage your photos" color="#22c55e" />
                <Tile index={4} to="/wallet" icon={Wallet} title="Wallet & Coins" sub="Recharge your balance" color="#fbbf24" />
                <Tile index={5} to="/recharge-history" icon={Receipt} title="Recharge History" sub="Your top-up requests & status" color="#38bdf8" />
                <Tile index={6} to="/withdraw" icon={Gem} title="Withdraw Points" sub="Cash out your earnings" color="#38bdf8" />
                <Tile index={7} to="/theme-shop" icon={ShoppingBag} title="Shop" sub="Cars, frames, rings, entrances & more" color="#fbbf24" />
                <Tile index={8} to="/custom-theme" icon={Palette} title="Custom Theme" sub="Design your own background" color="#8b5cf6" />
                <Tile index={9} to="/vip" icon={Crown} title="VIP Membership" sub="Upgrade & unlock milestone rewards" color="#fbbf24" />
                <Tile index={10} to="/rank" icon={Trophy} title="Rankings" sub="Top hosts, gifters & wealth" color="#38bdf8" />
                <Tile index={11} to="/games" icon={Gamepad2} title="Games" sub="Daily spin, lucky spin & more" color="#8b5cf6" />
                <Tile index={12} to="/my-rooms" icon={Home} title="My Rooms" sub="Room history, points & active time" color="#38bdf8" />
                <Tile index={13} to="/create-room" icon={Mic} title="Go Live" sub="Start a voice room now" color="#8b5cf6" />
                <Tile index={14} to="/pk-history" icon={Swords} title="PK History" sub="Battle wins & losses" color="#ff2d95" />
                <Tile index={15} to="/friends" icon={Users} title="Friends" sub="Followers & following" color="#8b5cf6" />
                <Tile index={16} to="/notifications" icon={Bell} title="Notifications" sub="Gifts, follows & room alerts" color="#ff2d95" />
                <Tile index={17} to="/settings/notifications" icon={SlidersHorizontal} title="Notification Settings" sub="Choose what alerts you get" color="#ff2d95" />
                <Tile index={18} to="/blocked" icon={UserX} title="Blocked Users" sub="Manage blocked list" color="#ff2d95" />
                <Tile index={19} to="/settings" icon={SettingsIcon} title="Settings" sub="Profile, password, privacy" color="#94a3b8" />
                <Tile index={20} to="/privacy" icon={Shield} title="Privacy Policy" sub="How we protect your data" color="#38bdf8" />
              </ul>
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function StatCell({
  to,
  icon,
  value,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center rounded-xl bg-white/5 py-1.5 active:scale-95 transition-transform">
      <div className="mb-0.5">{icon}</div>
      <p className="text-sm font-black leading-none" title={value.toLocaleString()}>
        {formatCompact(value)}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/60">{label}</p>
    </Link>
  );
}

function ProfileChip({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const className = "inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55 transition hover:text-white";
  if (onClick) {
    return (
      <button onClick={onClick} className={className} style={HEADING}>
        <Icon className="h-3 w-3" /> {label}
      </button>
    );
  }
  return (
    <span className={className} style={HEADING}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function ProfileSideCard({
  label,
  value,
  icon: Icon,
  place,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  place: 2 | 3;
}) {
  const theme = place === 2
    ? { border: "border-violet-500/30", chip: "bg-violet-500 text-white", rot: "rotate-[-4deg]", chipRot: "rotate-[4deg]", chipPos: "-top-2 -left-2", num: "text-[#8b5cf6]", glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]", color: "#8b5cf6" }
    : { border: "border-amber-500/30", chip: "bg-amber-500 text-black", rot: "rotate-[4deg]", chipRot: "rotate-[-4deg]", chipPos: "-top-2 -right-2", num: "text-[#fbbf24]", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", color: "#fbbf24" };

  return (
    <Link to={label === "Coins" ? "/wallet" : "/withdraw"} className="flex flex-1 flex-col items-center gap-3">
      <div className="relative">
        <div className={`grid h-20 w-20 place-items-center rounded-2xl border bg-white/5 p-1.5 backdrop-blur-xl ${theme.border} ${theme.rot} ${theme.glow}`}>
          <Icon className="h-9 w-9" style={{ color: theme.color, filter: `drop-shadow(0 0 10px ${theme.color}88)` }} />
          <div className={`absolute ${theme.chipPos} flex h-8 w-8 items-center justify-center rounded-lg text-xs shadow-lg ${theme.chip} ${theme.chipRot}`} style={HEADING}>
            {place}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="max-w-[92px] truncate text-sm font-bold tracking-tight text-white" style={BODY}>{label}</p>
        <p className={`text-[10px] uppercase tracking-widest ${theme.num}`} style={HEADING}>{formatCompact(value)}</p>
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/50">{label}</p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Quick({
  to,
  icon: Icon,
  label,
  color,
}: {
  to: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
      <Icon className="h-7 w-7" style={{ color, filter: `drop-shadow(0 0 8px ${color}66)` }} />
      <span className="text-[11px] font-bold text-white/85">{label}</span>
    </Link>
  );
}

function Tile({
  index,
  to,
  icon,
  title,
  sub,
  color,
  elite,
}: {
  index: number;
  to: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  sub: string;
  color: string;
  elite?: boolean;
}) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-3xl border border-white/5 bg-white/5 p-4 transition-all hover:border-[#ff2d95]/30 active:scale-[0.985]">
      <span className="w-8 text-lg italic text-white/25" style={HEADING}>{String(index).padStart(2, "0")}</span>
      <TileInner icon={icon} title={title} sub={sub} color={color} elite={elite} />
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </Link>
  );
}

function TileInner({
  icon: Icon,
  title,
  sub,
  color,
  elite,
}: {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  sub: string;
  color: string;
  elite?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 p-1">
        <Icon className="h-6 w-6" style={{ color, filter: `drop-shadow(0 0 10px ${color}88)` }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight text-white" style={BODY}>{title}</p>
        <p className="truncate text-[10px] leading-snug text-white/55">{sub}</p>
      </div>
      {elite && (
        <span className="rounded-sm bg-black/40 px-1 py-0.5 text-[9px] tracking-[0.1em] text-[#fbbf24]" style={HEADING}>
          Elite
        </span>
      )}
    </div>
  );
}
