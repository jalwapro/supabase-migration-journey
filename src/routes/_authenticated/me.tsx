import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Crown, Copy, ChevronRight, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";

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
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: counts } = useCounts(user?.id);

  return (
    <>
      <AppShell title="Profile">
        <div className="space-y-4 px-4 pb-6 pt-4">
          {/* Header card */}
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-3xl font-black">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{(profile?.username ?? "J").slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-black">@{profile?.username ?? "you"}</h2>
                  {profile?.is_vip && <Crown className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">Lv.{profile?.level ?? 1} · {user?.email}</p>
                {profile?.user_code && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.user_code!);
                      toast.success("ID copied");
                    }}
                    className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"
                  >
                    ID · {profile.user_code} <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Following / Followers / Diamonds / Coins */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
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
      <BottomNav />
    </>
  );
}

function StatLink({ to, value, label, gold }: { to: string; value: number; label: string; gold?: boolean }) {
  return (
    <Link to={to} className="rounded-2xl bg-card/60 py-2 active:scale-95 transition-transform">
      <p className={`text-base font-black ${gold ? "text-[color:var(--gold)]" : ""}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
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
      {gold ? <Shield className="h-4 w-4 text-[color:var(--gold)]" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </Link>
  );
}
