import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  QrCode,
  Pencil,
  MoreVertical,
  Copy,
  Mail,
  BadgeCheck,
  Users,
  UserPlus,
  Star,
  Coins,
  ChevronRight,
  Mic,
  Home,
  Swords,
  Gamepad2,
  ShoppingBag,
  Image as ImageIcon,
  Trophy,
  LayoutGrid,
  ShieldCheck,
  Wallet,
  Receipt,
  Gem,
  Palette,
  Crown,
  Bell,
  SlidersHorizontal,
  UserX,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, type ComponentType } from "react";
import { LevelAvatar } from "@/components/LevelAvatar";
import { formatCompact } from "@/lib/utils";
import { useVipProfile } from "@/hooks/useVipProfile";
import { vipTierForLevel, vipProgressFor, formatCoins, MILESTONE_REWARDS } from "@/lib/vip-levels";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

const HEADING = { fontFamily: "'Archivo Black', system-ui, sans-serif" } as const;
const NEON = { fontFamily: "'Great Vibes', 'Pacifico', cursive" } as const;

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
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("profiles").update({ avatar: pub.publicUrl }).eq("id", user.id);
      if (dbErr) throw dbErr;
      toast.success("Profile photo updated ✨");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
  const handleShare = async () => {
    const url = `${window.location.origin}/u/${profile?.user_code ?? user?.id}`;
    try {
      if (navigator.share) await navigator.share({ title: userName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch { /* dismissed */ }
  };

  return (
    <>
      <AppShell title="" subtitle="">
        <div className="relative min-h-full overflow-hidden text-white">
          {/* Cyberpunk header background */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-[360px] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3b1360_0%,#1a0733_40%,#080812_85%)]" />
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(180deg,transparent_0%,transparent_60%,rgba(255,45,149,0.35)_100%)]" />
            {/* skyline silhouette */}
            <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-24 w-full opacity-70">
              <defs>
                <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ff2d95" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <path fill="url(#sky)" d="M0,120 L0,80 L15,80 L20,60 L28,60 L28,40 L38,40 L38,70 L55,70 L60,50 L72,50 L72,30 L82,30 L82,65 L100,65 L104,45 L118,45 L118,25 L128,25 L128,58 L145,58 L152,38 L165,38 L165,60 L180,60 L184,40 L198,40 L198,20 L210,20 L210,55 L228,55 L233,35 L246,35 L246,58 L262,58 L268,40 L282,40 L282,22 L294,22 L294,58 L312,58 L316,40 L328,40 L328,62 L345,62 L350,45 L362,45 L362,25 L374,25 L374,60 L388,60 L392,45 L400,45 L400,120 Z" />
            </svg>
            {/* windows */}
            <div className="absolute inset-x-0 bottom-4 h-16 opacity-40 [background-image:radial-gradient(circle,rgba(255,183,77,0.5)_1px,transparent_1.5px)] [background-size:14px_14px]" />
          </div>

          {/* Top action row */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-4">
            <Link
              to="/"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-md"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <IconBtn onClick={() => toast.info("QR code coming soon")} label="QR code"><QrCode className="h-4 w-4" /></IconBtn>
              <Link to="/settings" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md" aria-label="Edit profile">
                <Pencil className="h-4 w-4" />
              </Link>
              <IconBtn onClick={handleShare} label="More"><MoreVertical className="h-4 w-4" /></IconBtn>
            </div>
          </div>

          {/* Neon Jalwa logo */}
          <div className="relative z-10 mt-1 text-center leading-none">
            <h1
              className="bg-gradient-to-b from-[#ff9ad0] to-[#ff2d95] bg-clip-text text-[54px] text-transparent"
              style={{ ...NEON, filter: "drop-shadow(0 0 14px rgba(255,45,149,0.75)) drop-shadow(0 0 4px rgba(255,45,149,0.9))" }}
            >
              Jalwa
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-white/80" style={HEADING}>Live your moment</p>
          </div>

          {/* Profile hero: avatar + info + stats box */}
          <div className="relative z-10 mt-3 flex items-start gap-3 px-4">
            {/* Avatar with wing frame */}
            <div className="relative shrink-0">
              <div className="absolute -inset-3 rounded-full bg-[#ff2d95]/25 blur-2xl" />
              <div className="relative rounded-full p-[3px] shadow-[0_0_30px_rgba(255,45,149,0.5)]"
                   style={{ background: "conic-gradient(from 0deg, #ff2d95, #8b5cf6, #38bdf8, #fbbf24, #ff2d95)" }}>
                <div className="rounded-full bg-black p-1">
                  <LevelAvatar
                    src={profile?.avatar}
                    name={profile?.username}
                    level={vipLevel}
                    size="xl"
                    frame={profile?.frame}
                    ring={profile?.ring}
                  />
                </div>
              </div>
              {/* Crown */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl" style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.9))" }}>👑</div>
              {/* Wings decorative */}
              <span aria-hidden className="pointer-events-none absolute top-1/2 -left-3 -translate-y-1/2 text-2xl opacity-80" style={{ filter: "drop-shadow(0 0 6px rgba(255,45,149,0.7))" }}>❰</span>
              <span aria-hidden className="pointer-events-none absolute top-1/2 -right-3 -translate-y-1/2 text-2xl opacity-80" style={{ filter: "drop-shadow(0 0 6px rgba(139,92,246,0.7))" }}>❱</span>
              {/* Lv badge */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-[#fbbf24] bg-gradient-to-b from-[#fbbf24] to-[#b8791b] px-3 py-0.5 text-[11px] text-black shadow-[0_0_10px_rgba(251,191,36,0.6)]" style={HEADING}>
                Lv {p.level}
              </div>
              {/* Camera */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change photo"
                className="absolute -right-1 top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-[#ff2d95] text-white shadow-[0_4px_12px_rgba(255,45,149,0.6)] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickAvatar(f); }} />
            </div>

            {/* Info column */}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[17px] font-bold text-white" style={HEADING}>{userName}</p>
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#38bdf8]" />
              </div>
              <p className="truncate text-xs text-white/60">@{userName.toLowerCase()}</p>
              {profile?.user_code && (
                <button onClick={handleCopyId} className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-white/70 hover:text-white">
                  ID: <span className="font-bold text-white">{profile.user_code}</span>
                  <Copy className="h-3 w-3" />
                </button>
              )}
              {user?.email && (
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/60">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to="/vip"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#c88a2b]/60 bg-gradient-to-r from-[#3d1f08] to-[#1a0a02] px-3 py-1.5 text-[11px] text-[#f5c46a] shadow-[0_0_16px_rgba(200,138,43,0.35)]"
                  style={HEADING}
                >
                  <Shield className="h-3.5 w-3.5" /> {tier.label}
                </Link>
                <span className="text-lg" title="Medal">🥉</span>
              </div>
            </div>

            {/* 2x2 Stats box */}
            <Link
              to="/friends"
              className="shrink-0 rounded-2xl border border-white/10 bg-black/50 p-2 backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.2)]"
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-center">
                <StatCell icon={<Users className="h-3.5 w-3.5 text-[#8b5cf6]" />} value={counts?.followers ?? 0} label="Followers" />
                <StatCell icon={<UserPlus className="h-3.5 w-3.5 text-[#38bdf8]" />} value={counts?.following ?? 0} label="Following" />
                <StatCell icon={<Star className="h-3.5 w-3.5 text-[#22c55e]" />} value={profile?.diamonds ?? 0} label="Points" />
                <StatCell icon={<Coins className="h-3.5 w-3.5 text-[#fbbf24]" />} value={profile?.coins ?? 0} label="Coins" />
              </div>
            </Link>
          </div>

          {/* Main body */}
          <div className="relative z-10 mt-4 space-y-3 px-3 pb-28">
            {/* VIP Progress card */}
            <div className="relative overflow-hidden rounded-[22px] border border-[#8b5cf6]/25 bg-gradient-to-br from-[#1a0733]/90 via-[#0f0620]/90 to-[#0a0416]/90 p-4 backdrop-blur-md shadow-[0_0_30px_rgba(139,92,246,0.2)]">
              <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#ff2d95]/20 blur-3xl" />
              <div className="relative grid grid-cols-[auto_1fr] gap-4 sm:grid-cols-[auto_1fr_1fr]">
                {/* Shield */}
                <div className="grid h-24 w-24 place-items-center rounded-2xl text-5xl" style={{ filter: "drop-shadow(0 0 12px rgba(251,191,36,0.5))" }}>
                  🛡️
                </div>
                {/* Progress info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-bold text-white" style={HEADING}>{tier.label}</p>
                    <span className="text-base">🥉</span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-white/50" style={HEADING}>Lifetime Gift</p>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-black text-white" style={HEADING}>{formatCoins(p.totalGifted)}</p>
                    <p className="text-xs text-white/75" style={HEADING}>Lv {p.level}</p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${p.percent}%`,
                        background: "linear-gradient(90deg, #fbbf24, #ff9a2d)",
                        boxShadow: "0 0 10px rgba(251,191,36,0.6)",
                      }}
                    />
                  </div>
                </div>
                {/* Milestone */}
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-white/60">Next milestone • <span className="text-white">Lv {nextMilestone}</span></p>
                  <Link to="/vip" className="mt-1 flex items-center gap-2 rounded-xl border border-[#8b5cf6]/30 bg-black/40 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white" style={HEADING}>{reward?.bundle ?? "Max reward"}</p>
                      <p className="text-[11px] text-[#fbbf24]" style={HEADING}>
                        +{(reward?.coins ?? 0).toLocaleString()} <Coins className="inline h-3 w-3" />
                      </p>
                    </div>
                    <div className="text-2xl">🎁</div>
                  </Link>
                  <Link to="/vip" className="mt-2 block">
                    <p className="text-xs font-bold text-white" style={HEADING}>Milestone Rewards</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/60">
                      View all 10 VIP milestone bundles <ChevronRight className="h-3 w-3" />
                    </p>
                  </Link>
                </div>
              </div>
              {/* Bottom stats row */}
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                <div><p className="text-[10px] uppercase tracking-widest text-white/50">Current</p><p className="text-base font-black text-white" style={HEADING}>{formatCoins(p.totalGifted - p.currentLevelStart)}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-white/50">{p.isMax ? "Max" : "Next Lv"}</p><p className="text-base font-black text-white" style={HEADING}>{p.isMax ? "MAX" : formatCoins(p.nextLevelAt)}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-white/50">Remaining</p><p className="text-base font-black text-white" style={HEADING}>{p.isMax ? "0" : formatCoins(p.remaining)}</p></div>
              </div>
            </div>

            {/* Quick Action bar */}
            <div className="rounded-[22px] border border-white/10 bg-black/50 p-3 backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <div className="grid grid-cols-4 gap-y-3 sm:grid-cols-8">
                <Quick to="/create-room" icon={Mic} label="Go Live" color="#ff2d95" />
                <Quick to="/my-rooms" icon={Home} label="My Rooms" color="#8b5cf6" />
                <Quick to="/pk" icon={Swords} label="PK" color="#fbbf24" />
                <Quick to="/games" icon={Gamepad2} label="Games" color="#22c55e" />
                <Quick to="/shop" icon={ShoppingBag} label="Shop" color="#38bdf8" />
                <Quick to="/rank" icon={Trophy} label="Rank" color="#fbbf24" />
                <Quick to="/friends" icon={Users} label="Friends" color="#8b5cf6" />
                <Quick to="/vip" icon={Crown} label="VIP" color="#fbbf24" />
              </div>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {isAdmin && <FeatureCard to="/admin" icon={ShieldCheck} title="Admin Panel" sub="Manage the whole app" color="#fbbf24" elite />}
              {isPartner && <FeatureCard to="/partner" icon={ShieldCheck} title="Partner" sub={`${partnerRow?.percentage ?? 0}% share`} color="#fbbf24" elite />}
              <FeatureCard to="/gallery" icon={ImageIcon} title="Gallery" sub="Manage your photos" color="#22c55e" />
              <FeatureCard to="/wallet" icon={Wallet} title="Wallet & Coins" sub="Recharge your balance" color="#fbbf24" />
              <FeatureCard to="/recharge-history" icon={Receipt} title="Recharge History" sub="Your top-up requests & status" color="#38bdf8" />
              <FeatureCard to="/withdraw" icon={Gem} title="Withdraw Points" sub="Cash out your earnings" color="#38bdf8" />
              <FeatureCard to="/theme-shop" icon={ShoppingBag} title="Shop" sub="Cars, frames, rings, entrances & more" color="#fbbf24" />
              <FeatureCard to="/custom-theme" icon={Palette} title="Custom Theme" sub="Design your own background" color="#8b5cf6" />
              <FeatureCard to="/vip" icon={Crown} title="VIP Membership" sub="Upgrade & unlock milestone rewards" color="#fbbf24" />
              <FeatureCard to="/rank" icon={Trophy} title="Rankings" sub="Top hosts, gifters & wealth" color="#38bdf8" />
              <FeatureCard to="/games" icon={Gamepad2} title="Games" sub="Daily spin, lucky spin & more" color="#8b5cf6" />
              <FeatureCard to="/my-rooms" icon={Home} title="My Rooms" sub="Room history, points & active time" color="#38bdf8" />
              <FeatureCard to="/create-room" icon={Mic} title="Go Live" sub="Start a voice room now" color="#8b5cf6" />
              <FeatureCard to="/pk-history" icon={Swords} title="PK History" sub="Battle wins & losses" color="#ff2d95" />
              <FeatureCard to="/friends" icon={Users} title="Friends" sub="Followers & following" color="#8b5cf6" />
              <FeatureCard to="/notifications" icon={Bell} title="Notifications" sub="Gifts, follows & room alerts" color="#ff2d95" />
              <FeatureCard to="/settings/notifications" icon={SlidersHorizontal} title="Notification Settings" sub="Choose what alerts you get" color="#ff2d95" />
              <FeatureCard to="/blocked" icon={UserX} title="Blocked Users" sub="Manage blocked list" color="#ff2d95" />
              <FeatureCard to="/settings" icon={SettingsIcon} title="Settings" sub="Profile, password, privacy" color="#94a3b8" />
              <FeatureCard to="/privacy" icon={Shield} title="Privacy Policy" sub="How we protect your data" color="#38bdf8" />
              <button
                onClick={() => signOut()}
                className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-[#ff2d95]/40 active:scale-[0.98]"
              >
                <FeatureInner icon={LogOut} title="Log Out" sub="Sign out from your account" color="#ff2d95" />
              </button>
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-md transition hover:border-white/30"
    >
      {children}
    </button>
  );
}

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center leading-none">
      {icon}
      <p className="mt-1 text-sm font-black text-white" style={HEADING} title={value.toLocaleString()}>
        {formatCompact(value)}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/60">{label}</p>
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
    <Link to={to} className="group flex flex-col items-center gap-1.5 transition active:scale-95">
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 transition group-hover:border-white/25"
        style={{ boxShadow: `inset 0 0 12px ${color}22` }}
      >
        <Icon className="h-5 w-5" style={{ color, filter: `drop-shadow(0 0 6px ${color}aa)` }} />
      </div>
      <span className="text-[11px] font-semibold text-white/85">{label}</span>
    </Link>
  );
}

function FeatureCard({
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
    <Link
      to={to}
      className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-[#ff2d95]/40 active:scale-[0.98]"
    >
      <div aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <FeatureInner icon={icon} title={title} sub={sub} color={color} elite={elite} />
      <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-white/30" />
    </Link>
  );
}

function FeatureInner({
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
    <div className="relative">
      <div className="flex items-start justify-between">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl bg-black/50"
          style={{ boxShadow: `inset 0 0 10px ${color}33` }}
        >
          <Icon className="h-5 w-5" style={{ color, filter: `drop-shadow(0 0 8px ${color}aa)` }} />
        </div>
        {elite && (
          <span
            className="rounded-md bg-gradient-to-r from-[#8b5cf6] to-[#ff2d95] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]"
            style={HEADING}
          >
            Elite
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[15px] font-bold text-white" style={HEADING}>{title}</p>
      <p className="mt-1 line-clamp-2 pr-6 text-[11px] leading-snug text-white/55">{sub}</p>
    </div>
  );
}
