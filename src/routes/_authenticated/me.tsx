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
  Gift,
  Mic,
  Home,
  Swords,
  Gamepad2,
  ShoppingBag,
  Image as ImageIcon,
  Trophy,
  LayoutGrid,
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

  return (
    <>
      <AppShell title="Profile">
        <div className="space-y-4 px-4 pb-6 pt-4">
          {/* ============ HERO ============ */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a0b2e] via-[#2d0b4d] to-[#050510] p-4 text-white shadow-2xl">
            {/* neon city glow ambient */}
            <div className="pointer-events-none absolute -top-16 right-0 h-56 w-72 rounded-full opacity-30" style={{ background: "radial-gradient(closest-side, #ff2d85aa, transparent 70%)" }} />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full opacity-20" style={{ background: "radial-gradient(closest-side, #7c3aedaa, transparent 70%)" }} />

            {/* Top: avatar + Jalwa neon header */}
            <div className="relative flex items-start gap-3">
              {/* Avatar w/ level frame */}
              <div className="relative shrink-0">
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
                  className="absolute right-0 top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-lg ring-2 ring-black/60 disabled:opacity-60"
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
              </div>

              {/* Neon Jalwa title */}
              <div className="relative ml-auto flex flex-col items-end pt-1">
                <div
                  className="text-3xl font-black italic leading-none"
                  style={{
                    fontFamily: "'Brush Script MT', cursive",
                    color: "#ff2d85",
                    textShadow: "0 0 8px #ff2d85, 0 0 18px #ff2d85, 0 0 28px #ff1478",
                  }}
                >
                  Jalwa
                </div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.28em] text-white/85">
                  Live your moment
                </div>
              </div>
            </div>

            {/* Info + stats */}
            <div className="relative mt-3 grid grid-cols-2 gap-3">
              {/* left: user info */}
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-lg font-black tracking-tight">{profile?.username ?? "you"}</h2>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
                </div>
                {profile?.username && (
                  <p className="truncate text-[11px] text-white/55">@{profile.username.toLowerCase()}</p>
                )}
                {profile?.user_code && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.user_code!);
                      toast.success("ID copied");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white/80"
                  >
                    ID: {profile.user_code} <Copy className="h-3 w-3" />
                  </button>
                )}
                {user?.email && (
                  <div className="flex items-center gap-1 truncate text-[11px] text-white/60">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  <Link
                    to="/vip"
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--gold)]/50 bg-gradient-to-r from-[color:var(--gold)]/25 to-transparent px-2.5 py-1 text-[11px] font-black text-white"
                  >
                    <Shield className="h-3 w-3 text-[color:var(--gold)]" /> {tier.label}
                  </Link>
                  <span className="text-base">🥇</span>
                  <Link
                    to="/settings"
                    aria-label="Edit profile"
                    className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/85"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* right: stats 2x2 box */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <StatCell
                    to="/friends"
                    icon={<Users className="h-4 w-4 text-[color:var(--secondary)]" />}
                    value={counts?.followers ?? 0}
                    label="Followers"
                  />
                  <StatCell
                    to="/friends"
                    icon={<Users className="h-4 w-4 text-sky-400" />}
                    value={counts?.following ?? 0}
                    label="Following"
                  />
                  <StatCell
                    to="/withdraw"
                    icon={<Star className="h-4 w-4 text-emerald-400" />}
                    value={profile?.diamonds ?? 0}
                    label="Points"
                  />
                  <StatCell
                    to="/wallet"
                    icon={<Coins className="h-4 w-4 text-[color:var(--gold)]" />}
                    value={profile?.coins ?? 0}
                    label="Coins"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============ VIP MILESTONE CARD ============ */}
          <div
            className="relative overflow-hidden rounded-3xl border border-[color:var(--secondary)]/40 p-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${tier.color}22, transparent 60%), linear-gradient(180deg, #1a0b2e, #0a0614)`,
              boxShadow: `0 0 40px -20px ${tier.glow}`,
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Left: bronze shield medal + progress */}
              <div className="flex gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 text-4xl shadow-inner">
                  🛡️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-black">{tier.label}</p>
                    <span className="text-sm">🥇</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">Lifetime Gift</p>
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-lg font-black text-[color:var(--gold)]">{formatCoins(p.totalGifted)}</p>
                    <p className="text-[10px] font-bold text-white/70">Lv {p.level}</p>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.percent}%`,
                        background: `linear-gradient(90deg, ${tier.color}, #fde68a)`,
                        boxShadow: `0 0 10px ${tier.glow}`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: next milestone bundle + rewards link */}
              <div className="space-y-2">
                {!p.isMax && reward && (
                  <div className="rounded-2xl border border-[color:var(--gold)]/30 bg-black/30 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-white/60">Next milestone • Lv {nextMilestone}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black">{reward.bundle}</p>
                        <p className="text-sm font-black text-[color:var(--gold)]">+{reward.coins.toLocaleString()} 🪙</p>
                      </div>
                      <span className="text-2xl">🎁</span>
                    </div>
                  </div>
                )}
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="flex w-full items-center justify-between text-left">
                      <div>
                        <p className="text-[12px] font-black">Milestone Rewards</p>
                        <p className="text-[10px] text-white/60">View all 10 VIP milestone bundles</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/60" />
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
            </div>

            {/* Bottom stats row */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Current" value={formatCoins(p.totalGifted - p.currentLevelStart)} />
              <MiniStat label={p.isMax ? "Max" : "Next Lv"} value={p.isMax ? "MAX" : formatCoins(p.nextLevelAt)} />
              <MiniStat label="Remaining" value={p.isMax ? "0" : formatCoins(p.remaining)} />
            </div>
          </div>

          {/* ============ QUICK ACTIONS RAIL ============ */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a0b2e]/80 to-[#0a0614]/90 p-3">
            <div className="grid grid-cols-4 gap-y-3 sm:grid-cols-8">
              <Quick to="/create-room" icon={Mic} label="Go Live" color="#ff2d85" />
              <Quick to="/my-rooms" icon={Home} label="My Rooms" color="#38bdf8" />
              <Quick to="/pk-history" icon={Swords} label="PK Battle" color="#ff2d85" />
              <Quick to="/games" icon={Gamepad2} label="Games" color="#a855f7" />
              <Quick to="/theme-shop" icon={ShoppingBag} label="Shop" color="#f59e0b" />
              <Quick to="/gallery" icon={ImageIcon} label="Gallery" color="#22c55e" />
              <Quick to="/rank" icon={Trophy} label="Rankings" color="#f59e0b" />
              <Quick to="/settings" icon={LayoutGrid} label="More" color="#a855f7" />
            </div>
          </div>

          {/* ============ MENU GRID ============ */}
          <div className="grid grid-cols-2 gap-3">
            {isAdmin && (
              <Tile to="/admin" icon={ShieldCheck} title="Admin Panel" sub="Manage the whole app" color="#f59e0b" elite />
            )}
            {isPartner && (
              <Tile to="/partner" icon={ShieldCheck} title="Partner" sub={`${partnerRow?.percentage ?? 0}% share`} color="#f59e0b" elite />
            )}
            <Tile to="/gallery" icon={ImageIcon} title="Gallery" sub="Manage your photos" color="#22c55e" />
            <Tile to="/wallet" icon={Wallet} title="Wallet & Coins" sub="Recharge your balance" color="#f59e0b" />
            <Tile to="/recharge-history" icon={Receipt} title="Recharge History" sub="Your top-up requests & status" color="#38bdf8" />
            <Tile to="/withdraw" icon={Gem} title="Withdraw Points" sub="Cash out your earnings" color="#38bdf8" />
            <Tile to="/theme-shop" icon={ShoppingBag} title="Shop" sub="Cars, frames, rings, entrances & more" color="#f59e0b" />
            <Tile to="/custom-theme" icon={Palette} title="Custom Theme" sub="Design your own background" color="#a855f7" />
            <Tile to="/vip" icon={Crown} title="VIP Membership" sub="Upgrade & unlock milestone rewards" color="#f59e0b" />
            <Tile to="/rank" icon={Trophy} title="Rankings" sub="Top hosts, gifters & wealth" color="#38bdf8" />
            <Tile to="/games" icon={Gamepad2} title="Games" sub="Daily spin, lucky spin & more" color="#a855f7" />
            <Tile to="/my-rooms" icon={Home} title="My Rooms" sub="Room history, points & active time" color="#38bdf8" />
            <Tile to="/create-room" icon={Mic} title="Go Live" sub="Start a voice room now" color="#a855f7" />
            <Tile to="/pk-history" icon={Swords} title="PK History" sub="Battle wins & losses" color="#ff2d85" />
            <Tile to="/friends" icon={Users} title="Friends" sub="Followers & following" color="#a855f7" />
            <Tile to="/notifications" icon={Bell} title="Notifications" sub="Gifts, follows & room alerts" color="#ff2d85" />
            <Tile to="/settings/notifications" icon={SlidersHorizontal} title="Notification Settings" sub="Choose what alerts you get" color="#ff2d85" />
            <Tile to="/blocked" icon={UserX} title="Blocked Users" sub="Manage blocked list" color="#ff2d85" />
            <Tile to="/settings" icon={SettingsIcon} title="Settings" sub="Profile, password, privacy" color="#94a3b8" />
            <Tile to="/privacy" icon={Shield} title="Privacy Policy" sub="How we protect your data" color="#38bdf8" />
            <button
              onClick={() => signOut()}
              className="group relative block text-left active:scale-[0.985] transition-transform"
            >
              <TileInner icon={LogOut} title="Log Out" sub="Sign out from your account" color="#ef4444" />
            </button>
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
  to,
  icon,
  title,
  sub,
  color,
  elite,
}: {
  to: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  sub: string;
  color: string;
  elite?: boolean;
}) {
  return (
    <Link to={to} className="group relative block active:scale-[0.985] transition-transform">
      <TileInner icon={icon} title={title} sub={sub} color={color} elite={elite} />
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
    <div
      className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a0b2e]/85 to-[#0a0614]/95 p-3"
      style={{ boxShadow: `inset 0 0 40px -18px ${color}55` }}
    >
      {/* concentric arcs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20"
        style={{ background: `radial-gradient(closest-side, ${color}, transparent 70%)` }}
      />
      {elite && (
        <span className="absolute right-2 top-2 rounded-md bg-[color:var(--secondary)]/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ring-1 ring-[color:var(--secondary)]/60">
          Elite
        </span>
      )}
      <Icon className="h-7 w-7" style={{ color, filter: `drop-shadow(0 0 10px ${color}88)` }} />
      <p className="mt-2 text-[13px] font-black leading-tight text-white">{title}</p>
      <p className="text-[10px] leading-snug text-white/55">{sub}</p>
    </div>
  );
}
