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
  Sparkles,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { LevelAvatar } from "@/components/LevelAvatar";
import { LevelBadge } from "@/components/LevelBadge";
import { LEVEL_TIERS, levelProgress, tierForLevel } from "@/lib/levels";

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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [frameSheetOpen, setFrameSheetOpen] = useState(false);

  const level = profile?.level ?? 0;
  const xp = profile?.xp ?? 0;
  const tier = tierForLevel(level);
  const prog = levelProgress(level, xp);

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
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a0b2e] via-[#2d0b4d] to-[#050510] p-5 text-white shadow-2xl">
            {/* ambient glow */}
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
              style={{ background: tier.glow }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full opacity-30 blur-3xl"
              style={{ background: "color-mix(in oklab, var(--primary) 70%, transparent)" }}
            />

            <div className="relative flex items-start gap-4">
              <div className="relative">
                <LevelAvatar
                  src={profile?.avatar}
                  name={profile?.username}
                  level={level}
                  size="xl"
                  showBadge
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change photo"
                  className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-lg ring-2 ring-black/60 disabled:opacity-60"
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
                    className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/85 backdrop-blur"
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
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/80"
                  >
                    ID · {profile.user_code} <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Ranking badge */}
            <button
              onClick={() => setFrameSheetOpen(true)}
              className="relative mt-5 flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left backdrop-blur"
              style={{
                borderColor: `${tier.color}80`,
                background: `linear-gradient(90deg, ${tier.color}22 0%, #0a011477 100%)`,
                boxShadow: `0 0 24px -6px ${tier.color}`,
              }}
            >
              <LevelBadge level={level} size="md" showLabel={false} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  Your Rank
                </p>
                <p
                  className="truncate text-lg font-black uppercase"
                  style={{ color: tier.color, textShadow: `0 0 10px ${tier.color}` }}
                >
                  {tier.label}
                </p>
                <p className="text-[11px] font-bold text-white/75">
                  Level {level} · Tap to view all tiers
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/60" />
            </button>

            {/* Level progress bar */}
            <button
              onClick={() => setFrameSheetOpen(true)}
              className="relative mt-5 block w-full text-left"
            >
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
                  <span className="text-white/85">{tier.label} Frame</span>
                </span>
                <span className="text-white/60">
                  {prog.have} / {prog.need} XP → Lv {level + 1}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${tier.ringGradient}`}
                  style={{ width: `${Math.max(4, prog.pct)}%` }}
                />
              </div>
            </button>

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
          <Row to="/theme-shop" icon="🎨" title="Theme Shop" sub="Unlock app themes" />
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

      {frameSheetOpen && (
        <FrameCollectionSheet
          currentLevel={level}
          onClose={() => setFrameSheetOpen(false)}
        />
      )}

      <BottomNav />
    </>
  );
}

function StatLink({ to, value, label, gold }: { to: string; value: number; label: string; gold?: boolean }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/10 bg-white/5 py-2 backdrop-blur active:scale-95 transition-transform"
    >
      <p className={`text-base font-black ${gold ? "text-[color:var(--gold)]" : "text-white"}`}>
        {value.toLocaleString()}
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

function FrameCollectionSheet({
  currentLevel,
  onClose,
}: {
  currentLevel: number;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-[#0a0114] p-5 text-white shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">
            <span className="bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] bg-clip-text text-transparent">
              Level Frames
            </span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-[11.5px] text-white/60">
          Level up to unlock premium avatar frames. Your current frame is highlighted.
        </p>
        <div className="grid max-h-[65dvh] grid-cols-3 gap-3 overflow-y-auto pr-1 scrollbar-hide">
          {LEVEL_TIERS.map((t) => {
            const unlocked = currentLevel >= t.minLevel;
            const current = currentLevel >= t.minLevel && currentLevel <= t.maxLevel;
            return (
              <div
                key={t.key}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ${
                  current
                    ? "border-[color:var(--gold)]/60 bg-white/10 shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_50%,transparent)]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <LevelAvatar level={t.minLevel} size="md" showBadge={false} />
                <div>
                  <p className="text-[11px] font-black">{t.label}</p>
                  <p className="text-[10px] text-white/60">
                    Lv {t.minLevel}
                    {t.maxLevel < 9999 ? `–${t.maxLevel}` : "+"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    current
                      ? "bg-[color:var(--gold)] text-black"
                      : unlocked
                        ? "bg-emerald-500/25 text-emerald-300"
                        : "bg-white/10 text-white/50"
                  }`}
                >
                  {current ? "Current" : unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
