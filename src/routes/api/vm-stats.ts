import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { LiveKitAPI } from "livekit-server-sdk";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
}

function serviceKey() {
  return process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
}

async function getUserId(token: string): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      return typeof payload.sub === "string" && (!payload.role || payload.role === "authenticated") ? payload.sub : null;
    } catch {
      return null;
    }
  }

  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

async function requireAdmin(token: string) {
  const userId = await getUserId(token);
  if (!userId) return false;
  const key = serviceKey();
  if (!key) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if (error) return false;
  return (data ?? []).some((row) => row.role === "admin" || row.role === "super_admin");
}

function getLiveKitApi() {
  const wsUrl = (process.env.LIVEKIT_URL || "").trim();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!wsUrl || !apiKey || !apiSecret) return null;
  const host = wsUrl.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
  return new LiveKitAPI({ host, apiKey, secret: apiSecret });
}

function vmMonitorConfig() {
  const url = (process.env.ORACLE_VM_MONITOR_URL || "").trim().replace(/\/$/, "");
  const secret = process.env.ORACLE_VM_MONITOR_SECRET;
  return url && secret ? { url, secret } : null;
}

export const Route = createFileRoute("/api/vm-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ error: "authentication required" }, 401);
        if (!(await requireAdmin(token))) return json({ error: "admin access required" }, 403);

        const monitor = vmMonitorConfig();
        if (!monitor) {
          return json({
            error: "Oracle VM monitor is not configured",
            detail: "Set ORACLE_VM_MONITOR_URL and ORACLE_VM_MONITOR_SECRET on the server.",
          }, 503);
        }

        let vm: any;
        try {
          const response = await fetch(`${monitor.url}/stats`, {
            headers: { Authorization: `Bearer ${monitor.secret}` },
            signal: AbortSignal.timeout(4000),
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`VM monitor returned HTTP ${response.status}`);
          vm = await response.json();
        } catch (error) {
          return json({ error: "Oracle VM monitor unreachable", detail: error instanceof Error ? error.message : "unknown error" }, 502);
        }

        const livekit = {
          activeRooms: 0,
          activeParticipants: 0,
          bandwidthMbps: Number(vm.livekit?.bandwidthMbps ?? vm.network?.egressMbps ?? 0),
          cpuUsagePercent: Number(vm.livekit?.cpuUsagePercent ?? vm.server?.cpuUsagePercent ?? 0),
          metricsAvailable: Boolean(vm.livekit?.metricsAvailable),
          error: null as string | null,
        };

        try {
          const api = getLiveKitApi();
          if (!api) throw new Error("LiveKit server credentials are not configured");
          const rooms = await api.room.listRooms();
          livekit.activeRooms = rooms.length;
          livekit.activeParticipants = rooms.reduce((sum: number, room) => sum + Number(room.numParticipants ?? 0), 0);
        } catch (error) {
          livekit.error = error instanceof Error ? error.message : "LiveKit room stats unavailable";
        }

        const cpu = Number(vm.server?.cpuUsagePercent ?? 0);
        const memory = Number(vm.server?.memoryUsagePercent ?? 0);
        const disk = Number(vm.server?.diskUsagePercent ?? 0);
        const thresholds = { cpuWarn: 60, cpuCritical: 80, memoryWarn: 70, memoryCritical: 85, diskWarn: 80, diskCritical: 90 };

        let statusColor = "green";
        let recommendation = "Optimal: current VM headroom looks healthy for additional traffic.";
        if (cpu >= thresholds.cpuCritical || memory >= thresholds.memoryCritical || disk >= thresholds.diskCritical) {
          statusColor = "red";
          recommendation = "Upgrade recommended: sustained high resource usage leaves too little headroom for reliable peak traffic.";
        } else if (cpu >= thresholds.cpuWarn || memory >= thresholds.memoryWarn || disk >= thresholds.diskWarn) {
          statusColor = "yellow";
          recommendation = "Moderate load: the VM is usable, but monitor peak traffic and plan capacity before a major growth spike.";
        }

        return json({
          server: {
            ...vm.server,
            loadAvg: vm.server?.loadAvg ?? null,
            network: vm.network ?? null,
          },
          livekit,
          insights: {
            recommendation,
            statusColor,
            thresholds,
            headroom: {
              cpuPercent: Math.max(0, Number((100 - cpu).toFixed(1))),
              memoryPercent: Math.max(0, Number((100 - memory).toFixed(1))),
              diskPercent: Math.max(0, Number((100 - disk).toFixed(1))),
            },
          },
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
