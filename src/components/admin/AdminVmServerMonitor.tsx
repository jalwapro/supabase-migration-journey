import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, Cpu, HardDrive, Loader2, MemoryStick, Network, RefreshCw, Server, Users, Radio, AlertTriangle, CheckCircle2, Mic, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ServiceStatus = "online" | "offline" | "not_configured";

export type VmStats = {
  vm: { status: ServiceStatus; error: string | null };
  server: {
    hostname?: string;
    uptimeHours?: number;
    cpuCores?: number;
    cpuUsagePercent?: number;
    memoryUsagePercent?: number;
    totalMemoryMB?: number;
    usedMemoryMB?: number;
    diskUsagePercent?: number;
    loadAvg?: number[] | null;
    network?: { rxMbps?: number; txMbps?: number; totalMbps?: number } | null;
  };
  livekit: {
    status: ServiceStatus;
    url: string | null;
    secure: boolean;
    latencyMs: number | null;
    activeRooms: number;
    activeParticipants: number;
    activePublishers: number;
    bandwidthMbps: number;
    cpuUsagePercent: number;
    metricsAvailable: boolean;
    error: string | null;
    rooms: { name: string; participants: number; publishers: number; createdAt: string | null; activeRecording: boolean }[];
  };
  app: { liveRooms: number; seatedUsers: number; roomMembers: number; error: string | null };
  insights: {
    recommendation: string;
    statusColor: "green" | "yellow" | "red";
    headroom: { cpuPercent: number; memoryPercent: number; diskPercent: number };
  };
  generatedAt: string;
};

function pct(value?: number) {
  return `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(1)}%`;
}

function StatusPill({ status, label }: { status: ServiceStatus; label: string }) {
  const tone = status === "online" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : status === "offline" ? "border-red-400/30 bg-red-400/10 text-red-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  const text = status === "online" ? "ONLINE" : status === "offline" ? "OFFLINE" : "SETUP";
  return <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${tone}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "animate-pulse bg-emerald-300" : status === "offline" ? "bg-red-300" : "bg-amber-300"}`} />{label} · {text}</span>;
}
function HudCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_12px_50px_rgba(0,0,0,0.22)] ${className}`}>{children}</div>;
}
function MetricCard({ icon: Icon, label, value, sub, percent, accent = "violet" }: { icon: typeof Cpu; label: string; value: string; sub?: string; percent?: number; accent?: "violet" | "cyan" | "green" | "amber" }) {
  const iconClass = { violet: "text-violet-300 bg-violet-400/10 border-violet-400/20", cyan: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20", green: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20", amber: "text-amber-300 bg-amber-400/10 border-amber-400/20" }[accent];
  return <HudCard className="group p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45"><Icon className="h-4 w-4 text-white/65" />{label}</div><div className={`rounded-lg border p-1.5 ${iconClass}`}><Activity className="h-3.5 w-3.5" /></div></div>
    <div className="mt-4 text-3xl font-black tracking-tight text-white">{value}</div>
    {sub && <div className="mt-1 text-[10px] font-medium text-white/40">{sub}</div>}
    {typeof percent === "number" && <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-300 transition-all duration-700" style={{ width: pct(percent) }} /></div>}
  </HudCard>;
}
export default function AdminVmServerMonitor() {
  const [stats, setStats] = useState<VmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("Admin session expired. Please sign in again.");
      const response = await fetch("/api/vm-stats", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      setStats(data as VmStats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load server telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = window.setInterval(fetchStats, 5000);
    return () => window.clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <div className="glass rounded-2xl p-8"><div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading live server telemetry…</div></div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6"><div className="flex items-center gap-2 font-bold text-red-500"><AlertTriangle className="h-5 w-5" /> Telemetry unavailable</div><p className="mt-2 text-sm text-muted-foreground">{error}</p><button onClick={fetchStats} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4" /> Retry</button></div>;
  if (!stats) return null;

  const { server, livekit, insights, app, vm } = stats;
  const insightClass = insights.statusColor === "red" ? "border-red-500/40 bg-red-500/5" : insights.statusColor === "yellow" ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5";
  const InsightIcon = insights.statusColor === "red" ? AlertTriangle : insights.statusColor === "yellow" ? Activity : CheckCircle2;
  const vmDown = vm.status !== "online";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#07070c] p-1 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
      <div className="relative space-y-5 p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70"><Server className="h-4 w-4" /> LIVE SERVER DASHBOARD</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight">JALWA VM COMMAND CENTER</h2>
            <p className="mt-1 text-xs text-white/45">LiveKit media server · {server.hostname || "jalwa-pro"}{livekit.url ? ` · ${livekit.url}` : ""}</p>
          </div>
          <button onClick={fetchStats} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200 disabled:opacity-60">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={livekit.status} label="LiveKit" />
        <StatusPill status={vm.status} label="VM agent" />
        {livekit.latencyMs !== null && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">API latency {livekit.latencyMs} ms</span>}
        {livekit.url && !livekit.secure && <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-500"><ShieldAlert className="h-3 w-3" /> Insecure ws:// URL — browsers block it on HTTPS</span>}
      </div>

      {(livekit.error || vm.error || app.error) && (
        <div className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          {livekit.error && <p><b className="text-foreground">LiveKit:</b> {livekit.error}</p>}
          {vm.error && <p><b className="text-foreground">VM agent:</b> {vm.error}</p>}
          {app.error && <p><b className="text-foreground">App stats:</b> {app.error}</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Radio} label="Active Rooms" value={String(livekit.activeRooms)} sub={`${app.liveRooms} live rooms in database`} />
        <MetricCard icon={Users} label="Participants" value={String(livekit.activeParticipants)} sub={`${app.roomMembers} members joined in app`} />
        <MetricCard icon={Mic} label="Publishers" value={String(livekit.activePublishers)} sub={`${app.seatedUsers} users on seats`} />
        <MetricCard icon={Network} label="Bandwidth" value={`${Number(livekit.bandwidthMbps ?? 0).toFixed(2)} Mbps`} sub={livekit.metricsAvailable ? "LiveKit metrics reachable" : "Host network throughput"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cpu} label="CPU" value={vmDown ? "—" : pct(server.cpuUsagePercent)} sub={vmDown ? "VM agent offline" : `${server.cpuCores ?? "?"} cores · load ${server.loadAvg?.[0]?.toFixed?.(2) ?? "—"}`} percent={vmDown ? undefined : server.cpuUsagePercent} />
        <MetricCard icon={MemoryStick} label="RAM" value={vmDown ? "—" : pct(server.memoryUsagePercent)} sub={vmDown ? "VM agent offline" : `${server.usedMemoryMB ?? 0} MB / ${server.totalMemoryMB ?? 0} MB`} percent={vmDown ? undefined : server.memoryUsagePercent} />
        <MetricCard icon={HardDrive} label="Disk" value={vmDown ? "—" : pct(server.diskUsagePercent)} sub="Root filesystem usage" percent={vmDown ? undefined : server.diskUsagePercent} />
        <MetricCard icon={Network} label="Network" value={vmDown ? "—" : `${Number(server.network?.totalMbps ?? 0).toFixed(2)} Mbps`} sub={vmDown ? "VM agent offline" : `↓ ${Number(server.network?.rxMbps ?? 0).toFixed(2)} · ↑ ${Number(server.network?.txMbps ?? 0).toFixed(2)}`} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Active rooms (live)</h3><span className="text-[11px] text-muted-foreground">{livekit.rooms.length} shown</span></div>
        {livekit.rooms.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No active LiveKit rooms right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr><th className="py-2 pr-3 font-semibold">Room</th><th className="py-2 pr-3 font-semibold">Users</th><th className="py-2 pr-3 font-semibold">Speaking (publishers)</th><th className="py-2 pr-3 font-semibold">Started</th></tr></thead>
              <tbody>
                {livekit.rooms.map((room) => (
                  <tr key={room.name} className="border-t border-border/50">
                    <td className="py-2 pr-3 font-mono text-[11px]">{room.name}</td>
                    <td className="py-2 pr-3 font-bold">{room.participants}</td>
                    <td className="py-2 pr-3">{room.publishers}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{room.createdAt ? new Date(room.createdAt).toLocaleTimeString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`rounded-xl border p-5 backdrop-blur-xl ${insightClass}`}>
        <div className="flex items-start gap-3"><InsightIcon className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="text-sm font-bold">CAPACITY // CORE HEADROOM</p><p className="mt-1 text-sm text-muted-foreground">{insights.recommendation}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground"><span>CPU headroom: <b className="text-foreground">{pct(insights.headroom.cpuPercent)}</b></span><span>RAM headroom: <b className="text-foreground">{pct(insights.headroom.memoryPercent)}</b></span><span>Disk headroom: <b className="text-foreground">{pct(insights.headroom.diskPercent)}</b></span></div></div></div>
      </div>

      <p className="text-[10px] text-muted-foreground">TELEMETRY LINK · Auto-refresh: 5s · Last sample: {new Date(stats.generatedAt).toLocaleTimeString()}</p>
    
      </div>
    </div>
  );
}
