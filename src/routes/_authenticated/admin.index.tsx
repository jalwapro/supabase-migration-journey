import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, DoorOpen, Wallet, Coins, Flag, Crown, TrendingUp, ArrowUpRight,
  Radio, Video, Mic, ArrowUpFromLine, Search, Bell, Calendar, Server, Database,
  CheckCircle2, AlertTriangle, Loader2, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

type RangePreset = "7d" | "30d" | "90d" | "custom";
type DateRange = { from: string; to: string; preset: RangePreset };

function defaultRange(preset: Exclude<RangePreset, "custom">): DateRange {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { preset, from: toYmd(from), to: toYmd(to) };
}
function toYmd(d: Date) { return d.toISOString().slice(0, 10); }
function rangeBounds(r: DateRange) {
  const from = new Date(`${r.from}T00:00:00.000Z`).toISOString();
  const to = new Date(`${r.to}T23:59:59.999Z`).toISOString();
  return { from, to };
}

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

// Cache admin dashboard queries aggressively so switching between admin
// pages (or coming back to the dashboard) doesn't re-run heavy Postgres
// counts. Realtime writes will still show up within staleTime on next mount.
const ADMIN_QUERY_OPTS = {
  staleTime: 120_000,
  gcTime: 10 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

type AdminDashboardSummary = {
  users: number;
  rooms: number;
  live_rooms: number;
  voice_rooms: number;
  video_rooms: number;
  pending_recharge: number;
  pending_withdrawal: number;
  pending_reports: number;
  vip_users: number;
  new_users: number;
  approved_recharges: number;
  revenue: number;
  withdrawn: number;
  coins_circulation: number;
  revenue_series: Array<{ key: string; name: string; value: number }>;
  recent_activity: Array<{ kind: "recharge" | "withdraw" | "signup"; id: string; when: string; label: string; sub: string; amount?: string; tone: string }>;
};

function useAdminDashboardSummary(range: DateRange, enabled: boolean) {
  return useQuery({
    queryKey: ["admin_dashboard_summary", range.from, range.to],
    queryFn: async (): Promise<AdminDashboardSummary> => {
      const { data, error } = await supabase.rpc("get_admin_dashboard_summary", {
        p_from: rangeBounds(range).from,
        p_to: rangeBounds(range).to,
      });
      if (error) throw error;
      return (data ?? {}) as AdminDashboardSummary;
    },
    ...ADMIN_QUERY_OPTS,
    enabled,
  });
}

function StatCard({ label, value, icon: Icon, tone, delta, sub }: {
  label: string; value: number | string; icon: LucideIcon; tone: string; delta?: string; sub?: string;
}) {
  return (
    <div className="emboss group relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {delta && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          <ArrowUpRight className="h-3 w-3" /> {delta}
        </div>
      )}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition group-hover:opacity-100" />
    </div>
  );
}



function useAdminHealth(enabled: boolean) {
  return useQuery({
    queryKey: ["admin_system_health"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const dbStart = performance.now();
      const dbResult = await supabase.from("app_settings").select("id").limit(1);
      const dbLatencyMs = Math.round(performance.now() - dbStart);
      let vm: any = null;
      if (token) {
        try {
          const response = await fetch("/api/vm-stats", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (response.ok) vm = await response.json();
        } catch {}
      }
      return {
        dbOk: !dbResult.error,
        dbLatencyMs,
        livekit: vm?.livekit?.status ?? "unknown",
        vm: vm?.vm?.status ?? "unknown",
        pendingRecharge: 0,
        vmError: vm?.vm?.error ?? null,
        livekitError: vm?.livekit?.error ?? null,
      };
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}


function RoleDashboard({ roles }: { roles: string[] }) {
  const role = roles.includes("finance_operator") ? "finance_operator" : roles.includes("moderator") ? "moderator" : roles.includes("agent") ? "agent" : "staff";
  const config = role === "finance_operator"
    ? { title: "Finance Operator", description: "Read-only finance overview. Payment approval and wallet changes remain restricted.", links: [{ to: "/admin/finance-reports", label: "Finance Reports" }] }
    : role === "moderator"
      ? { title: "Moderator Dashboard", description: "Review abuse reports and help keep JALWA voice rooms safe.", links: [{ to: "/admin/reports", label: "Review Reports" }, { to: "/admin/rooms", label: "View Rooms" }, { to: "/admin/rankings", label: "View Rankings" }] }
      : role === "agent"
        ? { title: "Support Agent Dashboard", description: "Respond to user support tickets. Recharge status is view-only; do not approve payments or edit balances.", links: [{ to: "/admin/support", label: "Open Support Tickets" }, { to: "/admin/users", label: "Find a User" }] }
        : { title: "Staff Dashboard", description: "Your account has limited staff permissions.", links: [] };
  return <div className="mx-auto max-w-3xl">
    <div className="glass rounded-3xl p-6 md:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">JALWA · Role Workspace</p>
      <h1 className="mt-2 text-2xl font-black">{config.title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{config.description}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {config.links.map((item) => <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4 text-sm font-bold transition hover:border-primary/50 hover:bg-primary/5">{item.label}<ArrowUpRight className="h-4 w-4 text-primary" /></Link>)}
      </div>
    </div>
  </div>;
}

function Dashboard() {
  const { profile, roles, isAdmin } = useAuth();
  const [range, setRange] = useState<DateRange>(() => defaultRange("30d"));
  const rangeLabel = useMemo(() => {
    if (range.preset === "7d") return "Last 7 days";
    if (range.preset === "30d") return "Last 30 days";
    if (range.preset === "90d") return "Last 90 days";
    return `${range.from} → ${range.to}`;
  }, [range]);

  const summary = useAdminDashboardSummary(range, isAdmin);
  const s = summary.data;
  const users = { data: s?.users ?? 0 };
  const rooms = { data: s?.rooms ?? 0 };
  const liveRooms = { data: s?.live_rooms ?? 0 };
  const voiceRooms = { data: s?.voice_rooms ?? 0 };
  const videoRooms = { data: s?.video_rooms ?? 0 };
  const pendingR = { data: s?.pending_recharge ?? 0 };
  const pendingW = { data: s?.pending_withdrawal ?? 0 };
  const reports = { data: s?.pending_reports ?? 0 };
  const vip = { data: s?.vip_users ?? 0 };
  const newUsers = { data: s?.new_users ?? 0 };
  const approvedInRange = { data: s?.approved_recharges ?? 0 };
  const revenue = { data: s?.revenue ?? 0 };
  const withdrawn = { data: s?.withdrawn ?? 0 };
  const coinsCirc = { data: s?.coins_circulation ?? 0 };
  const monthly = { data: s?.revenue_series ?? [] };
  const activity = { data: s?.recent_activity ?? [] };
  const health = useAdminHealth(isAdmin);

  if (!isAdmin) return <RoleDashboard roles={roles} />;

  const totalRooms = voiceRooms.data + videoRooms.data;
  const voicePct = totalRooms ? Math.round((voiceRooms.data / totalRooms) * 100) : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-3">
        <div className="flex items-center gap-2 mr-2">
          {health.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (health.data?.livekit === "online" && health.data?.dbOk) ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
          <span className="text-xs font-black uppercase tracking-wider">System Health</span>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${health.data?.livekit === "online" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          LiveKit: {health.data?.livekit ?? "checking"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${health.data?.dbOk && (health.data.dbLatencyMs < 800) ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          DB: {health.data ? `${health.data.dbLatencyMs}ms` : "checking"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${(pendingR.data ?? 0) < 25 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          Pending recharge: {(pendingR.data ?? 0).toLocaleString()}
        </span>
        {(health.data?.livekit === "offline" || !health.data?.dbOk || (health.data?.dbLatencyMs ?? 0) >= 800 || (pendingR.data ?? 0) >= 25) && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Attention required</span>
        )}
        <button onClick={() => void health.refetch()} className="ml-auto grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground" aria-label="Refresh health">
          <RefreshCw className={`h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Live overview · {rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter range={range} onChange={setRange} />
          <button className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card/50 text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
            {(pendingR.data ?? 0) + (pendingW.data ?? 0) + (reports.data ?? 0) > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 py-1 pl-1 pr-3">
            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-primary/20">
              {profile?.avatar ? <img src={profile.avatar} className="h-full w-full object-cover" alt="" /> : <Users className="h-3 w-3" />}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-bold leading-none">{profile?.username ?? "admin"}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Finance quick actions stay visible on desktop and mobile, not hidden in the sidebar. */}
      <section aria-label="Finance quick actions" className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link to="/admin/coin-agent" className="group flex min-h-[94px] items-center gap-4 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-4 transition hover:-translate-y-0.5 hover:border-amber-300">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 text-amber-300"><Coins className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-black text-amber-200">Coin Agent & P2P Control</span><span className="mt-1 block text-xs text-muted-foreground">Assign Super Coin Agents, manage pricing and agent access</span></span><ArrowUpRight className="h-5 w-5 shrink-0 text-amber-300 transition group-hover:translate-x-0.5" />
        </Link>
        <Link to="/admin/p2p" className="group flex min-h-[94px] items-center gap-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-zinc-950 via-card to-cyan-950/20 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300"><Wallet className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-black text-cyan-200">P2P Escrow & Settlements</span><span className="mt-1 block text-xs text-muted-foreground">Review disputes, payouts and transaction ledger</span></span><ArrowUpRight className="h-5 w-5 shrink-0 text-cyan-300 transition group-hover:translate-x-0.5" />
        </Link>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="New Users" value={newUsers.data ?? 0} icon={Users} tone="bg-primary/15 text-primary" sub={rangeLabel} />
        <StatCard label="Revenue (PKR)" value={`Rs ${Number(revenue.data ?? 0).toLocaleString()}`} icon={TrendingUp} tone="bg-[color:var(--gold)]/15 text-[color:var(--gold)]" sub={`${approvedInRange.data ?? 0} approved`} />
        <StatCard label="Pending Recharge" value={pendingR.data ?? 0} icon={Wallet} tone="bg-orange-500/15 text-orange-400" sub="All time" />
        <StatCard label="Coins in Circulation" value={compact(coinsCirc.data ?? 0)} icon={Coins} tone="bg-purple-500/15 text-purple-400" sub={`${users.data ?? 0} wallets`} />
      </div>


      {/* Chart + Room types */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="emboss rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Revenue Overview</p>
              <p className="text-[11px] text-muted-foreground">{rangeLabel} (PKR)</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400">Live</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly.data ?? []} margin={{ left: -10, right: 0 }}>
                <defs>
                  <linearGradient id="barPink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`PKR ${Number(v).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="value" fill="url(#barPink)" radius={[10, 10, 4, 4]}>
                  {(monthly.data ?? []).map((_: unknown, i: number) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="emboss rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-sm font-bold">Room Types</p>
            <p className="text-[11px] text-muted-foreground">Currently active</p>
          </div>
          <RoomRow icon={Mic} label="Voice Rooms" value={voiceRooms.data ?? 0} pct={voicePct} tone="bg-primary" />
          <div className="h-3" />
          <RoomRow icon={Video} label="Video Rooms" value={videoRooms.data ?? 0} pct={100 - voicePct} tone="bg-secondary" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat icon={Radio} label="Live Now" value={liveRooms.data ?? 0} tone="bg-red-500/15 text-red-400" />
            <MiniStat icon={DoorOpen} label="Rooms (All Time)" value={rooms.data ?? 0} tone="bg-primary/15 text-primary" />
            <MiniStat icon={Crown} label="VIP Members" value={vip.data ?? 0} tone="bg-purple-500/15 text-purple-400" />
            <MiniStat icon={Flag} label="Open Reports" value={reports.data ?? 0} tone="bg-red-500/15 text-red-400" />
          </div>
        </div>
      </div>

      {/* Recent activity + Quick actions */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="emboss rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Recent Activity</p>
            <Link to="/admin/logs" search={{ user: undefined }} className="text-[11px] font-bold text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-1.5">
            {(activity.data ?? []).map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-xl emboss-inset px-3 py-2.5">
                <div className={`grid h-8 w-8 place-items-center rounded-full ${row.kind === "recharge" ? "bg-emerald-500/15 text-emerald-400" : row.kind === "withdraw" ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"}`}>
                  {row.kind === "recharge" ? <Wallet className="h-4 w-4" /> : row.kind === "withdraw" ? <ArrowUpFromLine className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">{row.sub} · {timeAgo(row.when)}</p>
                </div>
                {row.amount && <span className={`text-xs font-bold ${row.tone}`}>{row.amount}</span>}
              </div>
            ))}
            {(activity.data?.length ?? 0) === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No recent activity</p>
            )}
          </div>
        </div>

        <div className="emboss rounded-2xl p-5">
          <p className="mb-3 text-sm font-bold">Quick Actions</p>
          <div className="space-y-2">
            <QuickLink to="/admin/recharge" label="Review Recharges" badge={pendingR.data ?? 0} icon={Wallet} />
            <QuickLink to="/admin/withdrawals" label="Approve Withdrawals" badge={pendingW.data ?? 0} icon={ArrowUpFromLine} />
            <QuickLink to="/admin/reports" label="Open Reports" badge={reports.data ?? 0} icon={Flag} />
            <QuickLink to="/admin/live" label="Live Rooms" badge={liveRooms.data ?? 0} icon={Radio} />
            <QuickLink to="/admin/users" label="Manage Users" icon={Users} />
          </div>
          <div className="mt-4 rounded-xl emboss-inset p-3 text-[11px] text-muted-foreground">
            <p className="font-bold text-foreground">Money out</p>
            <p className="mt-1">Total withdrawals paid: <span className="font-bold text-red-400">PKR {Number(withdrawn.data ?? 0).toLocaleString()}</span></p>
          </div>
        </div>
      </div>
    </>
  );
}

function RoomRow({ icon: Icon, label, value, pct, tone }: { icon: LucideIcon; label: string; value: number; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span className="font-bold">{value.toLocaleString()}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl emboss-inset p-2.5">
      <div className={`mb-1 grid h-6 w-6 place-items-center rounded-md ${tone}`}><Icon className="h-3 w-3" /></div>
      <p className="text-lg font-bold leading-none">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({ to, label, badge, icon: Icon }: { to: string; label: string; badge?: number; icon: LucideIcon }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl emboss-inset px-3 py-2.5 text-sm hover:brightness-125">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{badge}</span>
      )}
    </Link>
  );
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DateRangeFilter({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const presets: { key: Exclude<RangePreset, "custom">; label: string }[] = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
  ];
  return (
    <div className="relative">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/50 p-1">
        {presets.map((p) => {
          const active = range.preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onChange(defaultRange(p.key))}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${
            range.preset === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-3 w-3" /> Custom
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-muted-foreground">
              From
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => onChange({ ...range, preset: "custom", from: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              To
              <input
                type="date"
                value={range.to}
                min={range.from}
                max={toYmd(new Date())}
                onChange={(e) => onChange({ ...range, preset: "custom", to: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Close</button>
            <button
              onClick={() => { onChange(defaultRange("30d")); setOpen(false); }}
              className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold"
            >Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}
