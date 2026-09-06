import { useCallback, useEffect, useState } from "react";
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
  const tone = status === "online" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : status === "offline" ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-amber-500/40 bg-amber-500/10 text-amber-500";
  const text = status === "online" ? "Running" : status === "offline" ? "Offline" : "Not configured";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "animate-pulse bg-emerald-500" : status === "offline" ? "bg-red-500" : "bg-amber-500"}`} />
      {label}: {text}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, percent }: { icon: typeof Cpu; label: string; value: string; sub?: string; percent?: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      {typeof percent === "number" && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: pct(percent) }} /></div>}
    </div>
  );
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Server className="h-5 w-5 text-primary" /> Live Server Dashboard</h2>
          <p className="text-xs text-muted-foreground">LiveKit media server{server.hostname ? ` · ${server.hostname}` : ""}{livekit.url ? ` · ${livekit.url}` : ""}</p>
        </div>
        <button onClick={fetchStats} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-60">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</button>
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

      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
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

      <div className={`rounded-2xl border p-5 ${insightClass}`}>
        <div className="flex items-start gap-3"><InsightIcon className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="text-sm font-bold">Capacity Insight</p><p className="mt-1 text-sm text-muted-foreground">{insights.recommendation}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground"><span>CPU headroom: <b className="text-foreground">{pct(insights.headroom.cpuPercent)}</b></span><span>RAM headroom: <b className="text-foreground">{pct(insights.headroom.memoryPercent)}</b></span><span>Disk headroom: <b className="text-foreground">{pct(insights.headroom.diskPercent)}</b></span></div></div></div>
      </div>

      <p className="text-[10px] text-muted-foreground">Auto-refresh: 5s · Last sample: {new Date(stats.generatedAt).toLocaleTimeString()}</p>
    </div>
  );
}
