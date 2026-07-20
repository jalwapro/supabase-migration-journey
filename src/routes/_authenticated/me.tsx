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
      const [followers, following, visitors, liveRooms] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId!),
        supabase.from("profile_views").select("*", { count: "exact", head: true }).eq("owner_id", userId!),
        supabase.from("live_rooms").select("*", { count: "exact", head: true }).eq("host_id", userId!).eq("status", "live"),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        visitors: visitors.count ?? 0,
        liveRooms: liveRooms.count ?? 0,
      };
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
  const isVipActive = !!profile?.is_vip && (!profile?.vip_expiry || new Date(profile.vip_expiry) > new Date());
  const { data: adminVipTier } = useQuery({
    queryKey: ["me-admin-vip-tier", user?.id, isVipActive],
    enabled: !!user?.id && isVipActive,
    queryFn: async () => {
      const { data: tx } = await supabase
        .from("wallet_transactions")
        .select("note")
        .eq("user_id", user!.id)
        .eq("kind", "vip")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const noteName = tx?.note?.replace(/^Bought VIP\s*/i, "").trim();
      const { data: tiers } = await supabase.from("vip_tiers").select("*").eq("is_active", true).order("sort");
      const list = (tiers ?? []) as { id: string; name: string; badge_emoji: string | null; sort: number }[];
      if (noteName) {
        const hit = list.find((t) => t.name.toLowerCase() === noteName.toLowerCase());
        if (hit) return hit;
      }
      return list[list.length - 1] ?? null;
    },
  });
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
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://cloud-to-soul.lovable.app"}/u/${profile?.user_code ?? user?.id ?? ""}`;
  const handleShare = () => setShareOpen(true);

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        <div data-adaptive="neon" className="relative min-h-full overflow-hidden bg-background text-foreground">
          {/* Cyberpunk header background */}
          <div data-keep-dark aria-hidden className="absolute inset-x-0 top-0 h-[360px] overflow-hidden">
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
          <div data-keep-dark className="relative z-10 flex items-center justify-between px-4 pt-5">
            <Link
              to="/"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white/90 backdrop-blur-md transition hover:bg-black/70"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <IconBtn onClick={() => toast.info("QR code coming soon")} label="QR code"><QrCode className="h-[18px] w-[18px]" /></IconBtn>
              <Link to="/settings" className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md transition hover:bg-black/70" aria-label="Edit profile">
                <Pencil className="h-[18px] w-[18px]" />
              </Link>
              <IconBtn onClick={handleShare} label="More"><MoreVertical className="h-[18px] w-[18px]" /></IconBtn>
            </div>
          </div>

          {/* Neon Jalwa logo */}
          <div data-keep-dark className="relative z-10 mt-4 px-4 text-center leading-none">
            <h1
              className="bg-gradient-to-b from-[#ffb3dc] via-[#ff6fb5] to-[#ff2d95] bg-clip-text text-[52px] text-transparent"
              style={{ ...NEON, filter: "drop-shadow(0 0 14px rgba(255,45,149,0.6)) drop-shadow(0 0 3px rgba(255,45,149,0.85))" }}
            >
              Jalwa
            </h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.5em] text-white/70" style={HEADING}>Live your moment</p>
          </div>

          {/* ============ PROFILE CARD (Neon Royal design) ============ */}
          <div className="relative z-10 mt-6 px-3">
            <div
              data-keep-dark
              className="relative overflow-hidden rounded-[28px] border border-[#a855f7]/40 bg-gradient-to-br from-[#150726]/95 via-[#0d0420]/95 to-[#080212]/95 p-4"
              style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 40px rgba(168,85,247,0.35), inset 0 0 30px rgba(139,92,246,0.12)" }}
            >
              <CornerBrackets />
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#a855f7]/25 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-[#ff2d95]/20 blur-3xl" />

              {/* Avatar block — clean DP, equipped frame renders outside via LevelAvatar */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <LevelAvatar src={profile?.avatar} name={profile?.username} level={vipLevel} size="xl" frame={profile?.frame} ring={profile?.ring} showBadge={false} />
                  <span className="absolute bottom-1 right-1 z-30 h-4 w-4 rounded-full border-2 border-black bg-[#22c55e] shadow-[0_0_10px_#22c55e]" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change photo" className="absolute -right-1 top-0 z-30 grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-[#ec4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.7)] disabled:opacity-60">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickAvatar(f); }} />
                </div>
              </div>

              {/* Name + info */}
              <div className="relative z-10 mt-8 flex flex-col items-center gap-1.5 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="max-w-[240px] truncate text-[22px] font-black leading-tight text-white" style={HEADING}>{userName}</p>
                  <BadgeCheck className="h-5 w-5 shrink-0 fill-[#6366f1] text-white" />
                </div>
                <p className="text-[13px] leading-tight text-white/60">@{userName.toLowerCase()}</p>

                <div className="mt-1.5 flex w-full flex-col items-center gap-1.5 text-[12px] text-white/75">
                  {profile?.user_code && (
                    <button onClick={handleCopyId} className="inline-flex items-center gap-1.5 hover:text-white">
                      <span className="text-white/50">ID:</span>
                      <span className="font-bold text-white">{profile.user_code}</span>
                      <Copy className="h-3 w-3 text-white/50" />
                    </button>
                  )}
                  {user?.email && (
                    <span className="inline-flex max-w-[280px] items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-white/50" />
                      <span className="truncate">{user.email}</span>
                    </span>
                  )}
                  {profile?.country && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-sm">🌍</span>
                      <span className="text-white">{profile.country}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                  <Link to="/vip" className="inline-flex items-center gap-1.5 rounded-lg border border-[#c88a2b]/70 bg-gradient-to-b from-[#5a2f0a] to-[#1a0a02] px-3 py-1.5 text-[12px] font-black text-[#fbbf24] shadow-[0_0_18px_rgba(200,138,43,0.4)]" style={HEADING}>
                    <Crown className="h-3.5 w-3.5" /> {tier.label}
                  </Link>
                  {adminVipTier && (
                    <Link to="/vip" className="inline-flex items-center gap-1.5 rounded-lg border border-[#a855f7]/70 bg-gradient-to-b from-[#3a0f5c] to-[#180329] px-3 py-1.5 text-[12px] font-black text-white shadow-[0_0_18px_rgba(168,85,247,0.5)]" style={HEADING}>
                      <span className="text-sm leading-none">{adminVipTier.badge_emoji ?? "👑"}</span> {adminVipTier.name}
                    </Link>
                  )}
                  <span className="text-[22px] leading-none" style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.7))" }}>🏅</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <Chip color="#8b5cf6" icon="⚜️" label="Host" />
                  <Chip color="#ec4899" icon="🥊" label="PK King" />
                  <Chip color="#38bdf8" icon="✓" label="Official Host" outline />
                </div>

                <div className="mt-3 grid w-full grid-cols-2 gap-2.5">
                  <Link to="/settings" className="flex items-center justify-center gap-2 rounded-2xl border border-[#8b5cf6]/50 bg-[#1a0733]/70 px-3 py-2.5 text-[13px] font-bold text-white shadow-[0_0_14px_rgba(139,92,246,0.35)] transition active:scale-95" style={HEADING}>
                    <Pencil className="h-4 w-4 text-[#a855f7]" /> Edit Profile
                  </Link>
                  <button onClick={handleShare} className="flex items-center justify-center gap-2 rounded-2xl border border-[#c88a2b]/60 bg-gradient-to-b from-[#3d1f08] to-[#1a0a02] px-3 py-2.5 text-[13px] font-bold text-[#fbbf24] shadow-[0_0_14px_rgba(200,138,43,0.35)] transition active:scale-95" style={HEADING}>
                    <ChevronRight className="h-4 w-4 rotate-[-45deg]" /> Share Profile
                  </button>
                </div>

                <div className="mt-4 grid w-full grid-cols-3 gap-2">
                  <StatBox to="/friends" search={{ tab: "followers" }} icon={<Users className="h-4 w-4" />} color="#a855f7" value={counts?.followers ?? 0} label="Followers" />
                  <StatBox to="/friends" search={{ tab: "following" }} icon={<UserPlus className="h-4 w-4" />} color="#38bdf8" value={counts?.following ?? 0} label="Following" />
                  <StatBox to="/visitors" icon={<Users className="h-4 w-4" />} color="#ec4899" value={counts?.visitors ?? 0} label="Visitors" />
                  <StatBox icon={<Star className="h-4 w-4" />} color="#22c55e" value={profile?.xp ?? 0} label="Points" />
                  <StatBox to="/wallet" icon={<Coins className="h-4 w-4" />} color="#fbbf24" value={profile?.coins ?? 0} label="Coins" />
                  <StatBox to="/wallet" icon={<Gem className="h-4 w-4" />} color="#38bdf8" value={profile?.diamonds ?? 0} label="Diamonds" />
                  <StatBox to="/rank" icon={<Trophy className="h-4 w-4" />} color="#fbbf24" value={Number(vip?.row.total_gifted_coins ?? 0)} label="Popularity" />
                  <StatBox to="/vip" icon={<Crown className="h-4 w-4" />} color="#a855f7" value={vipLevel} label="Host Lv" />
                  <StatBox to="/my-rooms" icon={<Home className="h-4 w-4" />} color="#38bdf8" value={counts?.liveRooms ?? 0} label="Live Rooms" />
                </div>
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div className="relative z-10 mt-4 space-y-3 px-3 pb-28">
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
              <button onClick={() => signOut()} className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-[#ff2d95]/40 active:scale-[0.98]">
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

function CornerBrackets() {
  const c = "absolute h-6 w-6 border-[#fbbf24]";
  return (
    <>
      <span aria-hidden className={`${c} left-2 top-2 border-l-2 border-t-2 rounded-tl-2xl`} style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />
      <span aria-hidden className={`${c} right-2 top-2 border-r-2 border-t-2 rounded-tr-2xl`} style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />
      <span aria-hidden className={`${c} left-2 bottom-2 border-l-2 border-b-2 rounded-bl-2xl`} style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />
      <span aria-hidden className={`${c} right-2 bottom-2 border-r-2 border-b-2 rounded-br-2xl`} style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />
    </>
  );
}

function Chip({ color, icon, label, outline }: { color: string; icon: string; label: string; outline?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        color: outline ? color : "#fff",
        background: outline ? "transparent" : `linear-gradient(135deg, ${color}66, ${color}22)`,
        border: `1px solid ${color}${outline ? "" : "80"}`,
        boxShadow: `0 0 10px ${color}55`,
      }}
    >
      <span>{icon}</span>{label}
    </span>
  );
}

function StatBox({ icon, color, value, label, to, search }: { icon: React.ReactNode; color: string; value: number; label: string; to?: string; search?: Record<string, unknown> }) {
  const inner = (
    <>
      <span style={{ color, filter: `drop-shadow(0 0 6px ${color}aa)` }}>{icon}</span>
      <p className="mt-0.5 text-[15px] font-black leading-none text-white" style={HEADING} title={value.toLocaleString()}>
        {formatCompact(value)}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-white/55">{label}</p>
    </>
  );
  const cls = "flex flex-col items-center gap-0.5 rounded-2xl border border-white/10 bg-black/40 px-2 py-2.5 backdrop-blur-sm transition active:scale-95";
  const style = { boxShadow: `inset 0 0 12px ${color}22` } as const;
  if (to) {
    return (
      <Link to={to as any} search={search as any} className={cls} style={style}>{inner}</Link>
    );
  }
  return <div className={cls} style={style}>{inner}</div>;
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
      <p className="mt-3.5 truncate text-[15px] font-bold leading-tight text-white" style={HEADING}>{title}</p>
      <p className="mt-1.5 line-clamp-2 pr-6 text-[11px] leading-relaxed text-white/60">{sub}</p>
    </div>
  );
}
