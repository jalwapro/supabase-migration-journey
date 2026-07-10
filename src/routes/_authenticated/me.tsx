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
  Shield,
  Camera,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { LevelAvatar } from "@/components/LevelAvatar";
import { formatCompact } from "@/lib/utils";
import { VipProgressBar } from "@/components/vip/VipProgressBar";
import { VipRewardsGrid } from "@/components/vip/VipRewardsGrid";
import { useVipProfile } from "@/hooks/useVipProfile";
import { vipTierForLevel } from "@/lib/vip-levels";

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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const vipLevel = vip?.row.vip_level ?? 0;
  const tier = vipTierForLevel(vipLevel);

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
          {/* Premium hero card */}
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a0b2e] via-[#2d0b4d] to-[#050510] p-5 text-white shadow-2xl"
            style={
              profile?.data_card
                ? { backgroundImage: `url(${profile.data_card})`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            {profile?.data_card && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
                <div className="pointer-events-none absolute right-3 top-3 z-[2] rounded-lg bg-black/60 px-2.5 py-1.5 text-right text-white backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[color:var(--gold)]">
                    Data Card
                  </div>
                  <div className="max-w-[140px] truncate text-sm font-black leading-tight">
                    {profile.username ?? "Member"}
                  </div>
                  {profile.user_code && (
                    <div className="text-[10px] font-bold opacity-80">ID: {profile.user_code}</div>
                  )}
                </div>
              </>
            )}
            {/* Equipped entrance banner */}
            {profile?.entrance && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 overflow-hidden">
                {/\.(mp4|webm|mov)($|\?)/i.test(profile.entrance) ? (
                  <video src={profile.entrance} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                ) : (
                  <img src={profile.entrance} alt="" className="h-full w-full object-cover" />
                )}
                <div className="entrance-shimmer absolute inset-0" />
              </div>
            )}
            {/* ambient glow */}
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-20"
              style={{ background: tier.glow }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full opacity-15"
              style={{ background: "color-mix(in oklab, var(--primary) 70%, transparent)" }}
            />
            {/* Equipped car — decorative drive-across */}
            {profile?.car && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[1] h-10">
                <div className="car-drive absolute inset-y-0 left-0 w-24">
                  {/\.(mp4|webm|mov)($|\?)/i.test(profile.car) ? (
                    <video src={profile.car} autoPlay muted loop playsInline className="h-full w-full object-contain" />
                  ) : (
                    <img src={profile.car} alt="" className="h-full w-full object-contain" />
                  )}
                </div>
              </div>
            )}

            <div className="relative flex items-start gap-4">
              <div className="relative">
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
                  className="glow-4d absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-lg ring-2 ring-black/60 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
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

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-xl font-black">
                    @{profile?.username ?? "you"}
                  </h2>
                  {profile?.is_vip && (
                    <Crown className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                  )}
                  <Link
                    to="/settings"
                    aria-label="Edit profile"
                    className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white/85"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-white/60">
                  {user?.email}
                </p>
                {profile?.user_code && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.user_code!);
                      toast.success("ID copied");
                    }}
                    className="relative mt-2 inline-flex items-center gap-1 overflow-hidden rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/90"
                  >
                    {profile?.special_id && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-0 opacity-80"
                        style={{ backgroundImage: `url(${profile.special_id})`, backgroundSize: "cover", backgroundPosition: "center" }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1 font-black drop-shadow">
                      ID · {profile.user_code} <Copy className="h-3 w-3" />
                    </span>
                  </button>
                )}

              </div>
            </div>


            {/* VIP Gifting progress */}
            <div className="mt-4">
              <VipProgressBar
                totalGifted={Number(vip?.row.total_gifted_coins ?? 0)}
                storedLevel={vip?.row.vip_level ?? 0}
              />
            </div>

            {/* VIP Milestone Rewards */}
            <div className="mt-3">
              <VipRewardsGrid currentLevel={vip?.row.vip_level ?? 0} />
            </div>

            {/* Following / Followers / Diamonds / Coins */}
            <div className="relative mt-4 grid grid-cols-4 gap-2 text-center">
              <StatLink to="/friends" value={counts?.following ?? 0} label="Following" />
              <StatLink to="/friends" value={counts?.followers ?? 0} label="Followers" />
              <StatLink to="/withdraw" value={profile?.diamonds ?? 0} label="Diamonds" gold />
              <StatLink to="/wallet" value={profile?.coins ?? 0} label="Coins" />
            </div>
          </div>

          {/* Menu */}
          {isAdmin && <Row to="/admin" icon="🛡️" title="Admin Panel" sub="Manage the whole app" gold />}
          <Row to="/gallery" icon="📸" title="Gallery" sub="Manage your photos" />
          <Row to="/wallet" icon="💰" title="Wallet & Coins" sub="Recharge your balance" />
          <Row to="/withdraw" icon="💎" title="Withdraw Diamonds" sub="Cash out your earnings" />
          <Row to="/theme-shop" icon="🛍️" title="Shop" sub="Cars, frames, rings, entrances & more" />
          <Row to="/vip" icon="👑" title="VIP Membership" sub="Upgrade to VIP" />
          <Row to="/my-rooms" icon="🏠" title="My Rooms" sub="Room history, points & active time" />
          <Row to="/pk-history" icon="⚔️" title="PK History" sub="Battle wins & losses" />
          <Row to="/friends" icon="👥" title="Friends" sub="Followers & following" />
          <Row to="/blocked" icon="🚫" title="Blocked Users" sub="Manage blocked list" />
          <Row to="/settings" icon="⚙️" title="Settings" sub="Profile, password, privacy" />
          <Row to="/privacy" icon="🔒" title="Privacy Policy" sub="How we protect your data" />

          <button
            onClick={() => signOut()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 py-3 text-sm font-bold text-[color:var(--destructive)]"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      </AppShell>


      <BottomNav />
    </>
  );
}

function StatLink({ to, value, label, gold }: { to: string; value: number; label: string; gold?: boolean }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/10 bg-white/10 py-2 active:scale-95 transition-transform"
    >
      <p className={`text-base font-black ${gold ? "text-[color:var(--gold)]" : "text-white"}`}>
        <span title={value.toLocaleString()}>{formatCompact(value)}</span>
      </p>
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
    </Link>
  );
}

function Row({ to, icon, title, sub, gold }: { to: string; icon: string; title: string; sub: string; gold?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 active:scale-[0.98] transition-transform"
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${
          gold ? "bg-[color:var(--gold)]/20" : "bg-[color:var(--primary)]/15"
        }`}
      >
        <span>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${gold ? "text-[color:var(--gold)]" : ""}`}>{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
      {gold ? (
        <Shield className="h-4 w-4 text-[color:var(--gold)]" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </Link>
  );
}
