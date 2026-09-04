import { useCallback, useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, Loader2, MemoryStick, Network, RefreshCw, Server, Users, Radio, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type VmStats = {
  server: {
    hostname?: string;
    uptimeHours: number;
    cpuCores: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    totalMemoryMB: number;
    usedMemoryMB: number;
    diskUsagePercent: number;
    loadAvg?: number[] | null;
    network?: { rxMbps?: number; txMbps?: number; totalMbps?: number } | null;
  };
  livekit: {
    activeRooms: number;
    activeParticipants: number;
    bandwidthMbps: number;
    cpuUsagePercent: number;
    metricsAvailable: boolean;
    error: string | null;
  };
  insights: {
    recommendation: string;
    statusColor: "green" | "yellow" | "red";
    headroom: { cpuPercent: number; memoryPercent: number; diskPercent: number };
  };
  generatedAt: string;
};

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(1)}%`;
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
      const response = await fetch("/api/vm-stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      setStats(data as VmStats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load VM telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = window.setInterval(fetchStats, 10000);
    return () => window.clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <div className="glass rounded-2xl p-8"><div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading Oracle VM telemetry…</div></div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6"><div className="flex items-center gap-2 font-bold text-red-500"><AlertTriangle className="h-5 w-5" /> VM telemetry unavailable</div><p className="mt-2 text-sm text-muted-foreground">{error}</p><button onClick={fetchStats} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4" /> Retry</button></div>;
  if (!stats) return null;

  const { server, livekit, insights } = stats;
  const insightClass = insights.statusColor === "red" ? "border-red-500/40 bg-red-500/5" : insights.statusColor === "yellow" ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5";
  const InsightIcon = insights.statusColor === "red" ? AlertTriangle : insights.statusColor === "yellow" ? Activity : CheckCircle2;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-bold"><Server className="h-5 w-5 text-primary" /> VM Server</h2><p className="text-xs text-muted-foreground">Oracle Cloud VM hosting LiveKit v1.13.6{server.hostname ? ` · ${server.hostname}` : ""}</p></div>
        <button onClick={fetchStats} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-60">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cpu} label="CPU" value={pct(server.cpuUsagePercent)} sub={`${server.cpuCores} cores · load ${server.loadAvg?.[0]?.toFixed?.(2) ?? "—"}`} percent={server.cpuUsagePercent} />
        <MetricCard icon={MemoryStick} label="RAM" value={pct(server.memoryUsagePercent)} sub={`${server.usedMemoryMB} MB / ${server.totalMemoryMB} MB`} percent={server.memoryUsagePercent} />
        <MetricCard icon={HardDrive} label="Disk" value={pct(server.diskUsagePercent)} sub="Root filesystem usage" percent={server.diskUsagePercent} />
        <MetricCard icon={Network} label="Network" value={`${Number(server.network?.totalMbps ?? 0).toFixed(2)} Mbps`} sub={`↓ ${Number(server.network?.rxMbps ?? 0).toFixed(2)} · ↑ ${Number(server.network?.txMbps ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Radio} label="Active Rooms" value={String(livekit.activeRooms)} sub="LiveKit rooms" />
        <MetricCard icon={Users} label="Participants" value={String(livekit.activeParticipants)} sub="Current LiveKit participants" />
        <MetricCard icon={Activity} label="LiveKit CPU" value={pct(livekit.cpuUsagePercent)} sub="Host CPU (LiveKit VM)" percent={livekit.cpuUsagePercent} />
        <MetricCard icon={Network} label="Bandwidth" value={`${Number(livekit.bandwidthMbps ?? 0).toFixed(2)} Mbps`} sub={livekit.metricsAvailable ? "LiveKit metrics reachable" : "Host network throughput"} />
      </div>

      <div className={`rounded-2xl border p-5 ${insightClass}`}>
        <div className="flex items-start gap-3"><InsightIcon className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="text-sm font-bold">Capacity Insight</p><p className="mt-1 text-sm text-muted-foreground">{insights.recommendation}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground"><span>CPU headroom: <b className="text-foreground">{pct(insights.headroom.cpuPercent)}</b></span><span>RAM headroom: <b className="text-foreground">{pct(insights.headroom.memoryPercent)}</b></span><span>Disk headroom: <b className="text-foreground">{pct(insights.headroom.diskPercent)}</b></span></div></div></div>
      </div>

      <p className="text-[10px] text-muted-foreground">Auto-refresh: 10s · Last sample: {new Date(stats.generatedAt).toLocaleTimeString()}</p>
    </div>
  );
}
