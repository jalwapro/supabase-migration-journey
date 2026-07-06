import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Shield, LogOut, Settings, Crown, Gift, Trophy, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

function MePage() {
  const { user, profile, isAdmin, signOut } = useAuth();

  return (
    <>
      <AppShell title="Profile">
        <div className="space-y-4 px-4 pt-4">
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
                  <h2 className="truncate text-lg font-black">
                    @{profile?.username ?? "you"}
                  </h2>
                  {profile?.is_vip && (
                    <Crown className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
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
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Level" value={profile?.level ?? 1} />
              <Stat label="Coins" value={profile?.coins ?? 0} />
              <Stat label="Diamonds" value={profile?.diamonds ?? 0} />
            </div>
          </div>

          <MenuItem to="/wallet" Icon={Gift} label="Wallet & Recharge" />
          <MenuItem to="/rooms" Icon={Trophy} label="Live Rooms" />
          {isAdmin && (
            <MenuItem to="/admin" Icon={Shield} label="Admin Panel" gold />
          )}
          <MenuItem to="/me" Icon={Settings} label="Settings" disabled />

          <button
            onClick={() => signOut()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 py-3 text-sm font-bold text-[color:var(--destructive)]"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card/60 py-2">
      <p className="text-lg font-black">{value.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function MenuItem({
  to,
  Icon,
  label,
  gold,
  disabled,
}: {
  to: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  gold?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div
        className={`grid h-9 w-9 place-items-center rounded-xl ${
          gold
            ? "bg-[color:var(--gold)]/20 text-[color:var(--gold)]"
            : "bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  if (disabled) return content;
  return <Link to={to}>{content}</Link>;
}
