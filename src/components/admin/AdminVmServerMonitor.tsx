import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, Cpu, HardDrive, Loader2, MemoryStick, Network, RefreshCw, Server, Users, Radio, AlertTriangle, CheckCircle2, Mic, ShieldAlert, Zap } from "lucide-react";
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
  const tone = status === "online" 
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]" 
    : status === "offline" 
    ? "border-rose-500/40 bg-rose-500/10 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]" 
    : "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]";
  
  const text = status === "online" ? "ACTIVE" : status === "offline" ? "OFFLINE" : "STANDBY";
  
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${status === "online" ? "animate-ping bg-emerald-400" : status === "offline" ? "bg-rose-400" : "bg-amber-400"}`} />
      {label} <span className="opacity-40">/</span> {text}
    </span>
  );
}

function HudCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-cyan-500/20 bg-black/60 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,0,0,0.5)] transition-all duration-300 ${className}`}>
      {/* Sci-fi corner accents */}
      <div className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2 border-cyan-400/60" />
      <div className="absolute top-0 right-0 h-2 w-2 border-t-2 border-r-2 border-cyan-400/60" />
      <div className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2 border-cyan-400/60" />
      <div className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-cyan-400/60" />
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, percent, accent = "cyan" }: { icon: typeof Cpu; label: string; value: string; sub?: string; percent?: number; accent?: "cyan" | "fuchsia" | "emerald" | "amber" }) {
  const accentStyles = {
    cyan: { iconBg: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]", bar: "from-cyan-500 via-teal-400 to-emerald-400" },
    fuchsia: { iconBg: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.15)]", bar: "from-purple-600 via-fuchsia-500 to-pink-400" },
    emerald: { iconBg: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]", bar: "from-emerald-500 via-teal-400 to-cyan-400" },
    amber: { iconBg: "text-amber-300 bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]", bar: "from-amber-500 via-orange-500 to-red-500" },
  }[accent];

  return (
    <HudCard className="group p-4 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">
          <Icon className="h-4 w-4 text-cyan-400" />
          {label}
        </div>
        <div className={`rounded-lg border p-2 ${accentStyles.iconBg}`}>
          <Activity className="h-3.5 w-3.5 animate-pulse" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-300 font-mono">
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[10px] font-semibold text-cyan-300/50 tracking-wide">{sub}</div>}
      {typeof percent === "number" && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cyan-950/60 border border-cyan-500/20">
          <div className={`h-full rounded-full bg-gradient-to-r ${accentStyles.bar} transition-all duration-700 shadow-[0_0_10px_rgba(6,182,212,0.5)]`} style={{ width: pct(percent) }} />
        </div>
      )}
    </HudCard>
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

  if (loading) return <div className="rounded-2xl border border-cyan-500/30 bg-black/80 p-8 text-center text-cyan-400 font-mono"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3 text-cyan-400" /> INITIALIZING NEURAL TELEMETRY...</div>;
  if (error) return <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-6 text-rose-300 font-mono"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-rose-400" /> SYSTEM ERROR</div><p className="mt-2 text-xs opacity-80">{error}</p><button onClick={fetchStats} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/30"><RefreshCw className="h-4 w-4" /> Re-sync</button></div>;
  if (!stats) return null;

  const { server, livekit, insights, app, vm } = stats;
  const insightClass = insights.statusColor === "red" 
    ? "border-rose-500/50 bg-rose-950/20 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]" 
    : insights.statusColor === "yellow" 
    ? "border-amber-500/50 bg-amber-950/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]" 
    : "border-emerald-500/50 bg-emerald-950/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
    
  const InsightIcon = insights.statusColor === "red" ? AlertTriangle : insights.statusColor === "yellow" ? Activity : CheckCircle2;
  const vmDown = vm.status !== "online";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#030307] p-1.5 text-white border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
      {/* Sci-fi grid & cyberpunk vignette background */}
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(217,70,239,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-fuchsia-950/20" />

      <div className="relative space-y-5 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-cyan-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">
              <Zap className="h-4 w-4 text-cyan-400 animate-pulse" /> 
              <span>TACTICAL COMMAND HUD // v4.2</span>
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 font-mono">
              JALWA VM COMMAND CENTER
            </h2>
            <p className="mt-1 text-xs text-cyan-300/60 font-mono">
              NODE: {server.hostname || "jalwa-node-01"} {livekit.url ? `:: ${livekit.url}` : ""}
            </p>
          </div>
          <button 
            onClick={fetchStats} 
            disabled={refreshing} 
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 transition-all hover:bg-cyan-500/20 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> : <RefreshCw className="h-4 w-4 text-cyan-400" />} 
            Sync Telemetry
          </button>
        </div>

        {/* Status Pills Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={livekit.status} label="LiveKit Core" />
          <StatusPill status={vm.status} label="VM Sentinel" />
          {livekit.latencyMs !== null && (
            <span className="rounded-lg border border-cyan-500/30 bg-black/50 px-3 py-1.5 text-[11px] font-mono font-bold text-cyan-300 backdrop-blur-md">
              PING <span className="text-white">{livekit.latencyMs}ms</span>
            </span>
          )}
          {livekit.url && !livekit.secure && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" /> INSECURE WS PROTOCOL
            </span>
          )}
        </div>

        {/* Error Banners */}
        {(livekit.error || vm.error || app.error) && (
          <div className="space-y-1.5 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs font-mono text-amber-200 backdrop-blur-md">
            {livekit.error && <p><b className="text-amber-400">LiveKit Alert:</b> {livekit.error}</p>}
            {vm.error && <p><b className="text-amber-400">VM Sentinel Alert:</b> {vm.error}</p>}
            {app.error && <p><b className="text-amber-400">App Core Alert:</b> {app.error}</p>}
          </div>
        )}

        {/* Primary Stream Metrics */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Radio} label="Active Rooms" value={String(livekit.activeRooms)} sub={`${app.liveRooms} recorded in DB`} accent="cyan" />
          <MetricCard icon={Users} label="Participants" value={String(livekit.activeParticipants)} sub={`${app.roomMembers} connected users`} accent="fuchsia" />
          <MetricCard icon={Mic} label="Audio Publishers" value={String(livekit.activePublishers)} sub={`${app.seatedUsers} active speakers`} accent="emerald" />
          <MetricCard icon={Network} label="Bandwidth Load" value={`${Number(livekit.bandwidthMbps ?? 0).toFixed(2)} Mbps`} sub={livekit.metricsAvailable ? "LiveKit telemetry synced" : "Host interface throughput"} accent="cyan" />
        </div>

        {/* System Resource Gauges */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Cpu} label="CPU Load" value={vmDown ? "OFFLINE" : pct(server.cpuUsagePercent)} sub={vmDown ? "Agent disconnected" : `${server.cpuCores ?? "?"} Cores · Load: ${server.loadAvg?.[0]?.toFixed?.(2) ?? "—"}`} percent={vmDown ? undefined : server.cpuUsagePercent} accent="amber" />
          <MetricCard icon={MemoryStick} label="Memory Usage" value={vmDown ? "OFFLINE" : pct(server.memoryUsagePercent)} sub={vmDown ? "Agent disconnected" : `${server.usedMemoryMB ?? 0} MB / ${server.totalMemoryMB ?? 0} MB`} percent={vmDown ? undefined : server.memoryUsagePercent} accent="fuchsia" />
          <MetricCard icon={HardDrive} label="Storage Capacity" value={vmDown ? "OFFLINE" : pct(server.diskUsagePercent)} sub="Root volume utilization" percent={vmDown ? undefined : server.diskUsagePercent} accent="cyan" />
          <MetricCard icon={Network} label="Network Traffic" value={vmDown ? "OFFLINE" : `${Number(server.network?.totalMbps ?? 0).toFixed(2)} Mbps`} sub={vmDown ? "Agent disconnected" : `↓ ${Number(server.network?.rxMbps ?? 0).toFixed(2)} · ↑ ${Number(server.network?.txMbps ?? 0).toFixed(2)}`} accent="emerald" />
        </div>

        {/* Active Rooms Grid Table */}
        <HudCard className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400 animate-pulse" /> Active Broadcast Rooms
            </h3>
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono text-cyan-300">
              {livekit.rooms.length} CHANNELS OPEN
            </span>
          </div>

          {livekit.rooms.length === 0 ? (
            <p className="py-8 text-center text-xs font-mono text-cyan-300/40 uppercase tracking-widest">No active audio streams detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-cyan-300/60 uppercase tracking-wider text-[10px] border-b border-cyan-500/20">
                  <tr>
                    <th className="py-2.5 pr-3 font-bold">Channel ID / Name</th>
                    <th className="py-2.5 pr-3 font-bold">Users</th>
                    <th className="py-2.5 pr-3 font-bold">Speakers</th>
                    <th className="py-2.5 pr-3 font-bold">Uptime Start</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/10">
                  {livekit.rooms.map((room) => (
                    <tr key={room.name} className="transition-colors hover:bg-cyan-500/5">
                      <td className="py-3 pr-3 text-cyan-200 font-bold">{room.name}</td>
                      <td className="py-3 pr-3 text-white font-bold">{room.participants}</td>
                      <td className="py-3 pr-3 text-emerald-300">{room.publishers}</td>
                      <td className="py-3 pr-3 text-cyan-300/50">{room.createdAt ? new Date(room.createdAt).toLocaleTimeString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HudCard>

        {/* AI Recommendations / Insights Box */}
        <div className={`rounded-xl border p-4 sm:p-5 backdrop-blur-xl ${insightClass}`}>
          <div className="flex items-start gap-3.5">
            <InsightIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 font-mono">
              <p className="text-xs font-black uppercase tracking-[0.2em]">CORE RESOURCE HEADROOM // AI DIAGNOSTIC</p>
              <p className="mt-1.5 text-xs opacity-95">{insights.recommendation}</p>
              <div className="mt-3.5 grid grid-cols-3 gap-3 text-[11px] border-t border-current/20 pt-3">
                <span>CPU Buffer: <b className="font-bold">{pct(insights.headroom.cpuPercent)}</b></span>
                <span>RAM Buffer: <b className="font-bold">{pct(insights.headroom.memoryPercent)}</b></span>
                <span>Disk Buffer: <b className="font-bold">{pct(insights.headroom.diskPercent)}</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Timestamp */}
        <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300/40 uppercase tracking-widest pt-1 border-t border-cyan-500/10">
          <span>SECURE TELEMETRY LINK ACTIVE</span>
          <span>SYNC INTERVAL: 5s // LAST: {new Date(stats.generatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
