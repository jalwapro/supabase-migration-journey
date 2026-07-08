import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, DoorOpen, Wallet, Coins, Flag, Crown, TrendingUp, ArrowUpRight,
  Radio, Video, Mic, ArrowUpFromLine, Search, Bell, Calendar,
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

function useCount(table: string, filter?: { col: string; val: string }) {
  return useQuery({
    queryKey: ["admin_count", table, filter],
    queryFn: async () => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      if (filter) q = q.eq(filter.col, filter.val);
      const { count } = await q;
      return count ?? 0;
    },
  });
}

function useSum(table: string, col: string, filter?: { c: string; v: string }, range?: DateRange) {
  return useQuery({
    queryKey: ["admin_sum", table, col, filter, range?.from, range?.to],
    queryFn: async (): Promise<number> => {
      let q = supabase.from(table).select(`${col},created_at`);
      if (filter) q = q.eq(filter.c, filter.v);
      if (range) {
        const b = rangeBounds(range);
        q = q.gte("created_at", b.from).lte("created_at", b.to);
      }
      const { data } = await q;
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      return rows.reduce((s, r) => s + Number(r[col] ?? 0), 0);
    },
  });
}

function useRangeCount(table: string, filter: { col: string; val: string } | undefined, range: DateRange) {
  return useQuery({
    queryKey: ["admin_rcount", table, filter, range.from, range.to],
    queryFn: async () => {
      const b = rangeBounds(range);
      let q = supabase.from(table).select("id", { count: "exact", head: true })
        .gte("created_at", b.from).lte("created_at", b.to);
      if (filter) q = q.eq(filter.col, filter.val);
      const { count } = await q;
      return count ?? 0;
    },
  });
}

function useRevenueSeries(range: DateRange) {
  return useQuery({
    queryKey: ["admin_rev_series", range.from, range.to],
    queryFn: async () => {
      const b = rangeBounds(range);
      const { data } = await supabase
        .from("recharge_requests")
        .select("amount_pkr,created_at,status")
        .eq("status", "approved")
        .gte("created_at", b.from)
        .lte("created_at", b.to);

      const start = new Date(`${range.from}T00:00:00.000Z`);
      const end = new Date(`${range.to}T00:00:00.000Z`);
      const days = Math.max(1, Math.round((+end - +start) / 86400000) + 1);
      const useMonthly = days > 120;

      type Bucket = { key: string; name: string; value: number };
      const buckets: Bucket[] = [];
      const idx = new Map<string, Bucket>();

      if (useMonthly) {
        const cur = new Date(start); cur.setUTCDate(1);
        while (cur <= end) {
          const key = `${cur.getUTCFullYear()}-${cur.getUTCMonth()}`;
          const bk: Bucket = { key, name: cur.toLocaleString("en", { month: "short", year: "2-digit" }), value: 0 };
          buckets.push(bk); idx.set(key, bk);
          cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
      } else {
        const cur = new Date(start);
        while (cur <= end) {
          const key = toYmd(cur);
          const bk: Bucket = { key, name: cur.toLocaleDateString("en", { month: "short", day: "numeric" }), value: 0 };
          buckets.push(bk); idx.set(key, bk);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
      (data ?? []).forEach((r: Record<string, unknown>) => {
        const dt = new Date(r.created_at as string);
        const key = useMonthly ? `${dt.getUTCFullYear()}-${dt.getUTCMonth()}` : toYmd(dt);
        const bk = idx.get(key);
        if (bk) bk.value += Number(r.amount_pkr ?? 0);
      });
      return buckets;
    },
  });
}


function useRecentActivity() {
  return useQuery({
    queryKey: ["admin_recent_activity"],
    queryFn: async () => {
      const [rech, wd, users] = await Promise.all([
        supabase.from("recharge_requests").select("id,amount_pkr,coins_expected,status,created_at,user_id").order("created_at", { ascending: false }).limit(4),
        supabase.from("withdrawal_requests").select("id,amount_pkr,status,created_at,user_id").order("created_at", { ascending: false }).limit(4),
        supabase.from("profiles").select("id,username,avatar,created_at").order("created_at", { ascending: false }).limit(4),
      ]);
      type Row = { kind: "recharge" | "withdraw" | "signup"; id: string; when: string; label: string; sub: string; amount?: string; tone: string };
      const rows: Row[] = [];
      (rech.data ?? []).forEach((r) => rows.push({
        kind: "recharge", id: `r-${r.id}`, when: r.created_at,
        label: `Recharge ${r.status}`, sub: `${Number(r.coins_expected ?? 0).toLocaleString()} coins`,
        amount: `+PKR ${Number(r.amount_pkr ?? 0).toLocaleString()}`, tone: "text-emerald-400",
      }));
      (wd.data ?? []).forEach((r) => rows.push({
        kind: "withdraw", id: `w-${r.id}`, when: r.created_at,
        label: `Withdrawal ${r.status}`, sub: "Diamond cash-out",
        amount: `-PKR ${Number(r.amount_pkr ?? 0).toLocaleString()}`, tone: "text-red-400",
      }));
      (users.data ?? []).forEach((u) => rows.push({
        kind: "signup", id: `u-${u.id}`, when: u.created_at,
        label: `@${u.username ?? "user"} joined`, sub: "New signup", tone: "text-primary",
      }));
      return rows.sort((a, b) => +new Date(b.when) - +new Date(a.when)).slice(0, 10);
    },
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

function Dashboard() {
  const { profile } = useAuth();
  const [range, setRange] = useState<DateRange>(() => defaultRange("30d"));
  const rangeLabel = useMemo(() => {
    if (range.preset === "7d") return "Last 7 days";
    if (range.preset === "30d") return "Last 30 days";
    if (range.preset === "90d") return "Last 90 days";
    return `${range.from} → ${range.to}`;
  }, [range]);

  const users = useCount("profiles");
  const rooms = useCount("rooms");
  const liveRooms = useCount("rooms", { col: "is_live", val: "true" });
  const voiceRooms = useCount("rooms", { col: "room_type", val: "voice" });
  const videoRooms = useCount("rooms", { col: "room_type", val: "video" });
  const pendingR = useCount("recharge_requests", { col: "status", val: "pending" });
  const pendingW = useCount("withdrawal_requests", { col: "status", val: "pending" });
  const reports = useCount("user_reports", { col: "status", val: "pending" });
  const vip = useCount("profiles", { col: "is_vip", val: "true" });

  const newUsers = useRangeCount("profiles", undefined, range);
  const approvedInRange = useRangeCount("recharge_requests", { col: "status", val: "approved" }, range);
  const revenue = useSum("recharge_requests", "amount_pkr", { c: "status", v: "approved" }, range);
  const withdrawn = useSum("withdrawal_requests", "amount_pkr", { c: "status", v: "approved" }, range);
  const coinsCirc = useSum("profiles", "coins");
  const monthly = useRevenueSeries(range);
  const activity = useRecentActivity();


  const totalRooms = (voiceRooms.data ?? 0) + (videoRooms.data ?? 0);
  const voicePct = totalRooms ? Math.round(((voiceRooms.data ?? 0) / totalRooms) * 100) : 0;

  return (
    <>
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
              <p className="text-[11px] text-muted-foreground">Last 12 months (PKR)</p>
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
                  {(monthly.data ?? []).map((_, i) => <Cell key={i} />)}
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
            <MiniStat icon={DoorOpen} label="Total Rooms" value={rooms.data ?? 0} tone="bg-primary/15 text-primary" />
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
            <Link to="/admin/logs" className="text-[11px] font-bold text-primary hover:underline">View all</Link>
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
