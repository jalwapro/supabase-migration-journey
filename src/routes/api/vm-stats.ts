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
  // Always prefer Supabase Auth's server-side token validation when the
  // privileged server key is available. This also works when the project
  // uses a non-HS256 signing key or when the JWT secret has changed.
  const key = serviceKey();
  if (key) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (!error && data.user) return data.user.id;
  }

  // Fallback for deployments that intentionally do not expose a server key.
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && (!payload.role || payload.role === "authenticated") ? payload.sub : null;
  } catch {
    return null;
  }
}

async function adminClient(token: string) {
  const userId = await getUserId(token);
  console.log("VM-Stats Diagnostic - Auth Check:", {
    hasToken: !!token,
    hasUserId: !!userId,
  });

  if (!userId) return null;
  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");

  const sb = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: isAdmin, error: rpcError } = await sb.rpc("is_admin", { _user_id: userId });
  console.log("VM-Stats Diagnostic - Admin Check:", {
    isAdmin: isAdmin === true,
    hasRpcError: !!rpcError,
  });

  if (rpcError || isAdmin !== true) return null;
  return sb;
}

function getLiveKitApi() {
  const wsUrl = (process.env.LIVEKIT_URL || "").trim();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!wsUrl || !apiKey || !apiSecret) return null;
  const host = wsUrl.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
  return { api: new LiveKitAPI({ host, apiKey, secret: apiSecret }), host, wsUrl };
}

function vmMonitorConfig() {
  const url = (process.env.ORACLE_VM_MONITOR_URL || "").trim().replace(/\/$/, "");
  const secret = process.env.ORACLE_VM_MONITOR_SECRET;
  return url && secret ? { url, secret } : null;
}

type VmPayload = {
  server?: Record<string, unknown> & { cpuUsagePercent?: number; memoryUsagePercent?: number; diskUsagePercent?: number };
  network?: Record<string, unknown>;
  livekit?: { bandwidthMbps?: number; cpuUsagePercent?: number; metricsAvailable?: boolean };
};

export const Route = createFileRoute("/api/vm-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ error: "authentication required" }, 401);
        const sb = await adminClient(token);
        if (!sb) return json({ error: "admin access required" }, 403);

        const monitor = vmMonitorConfig();
        let vm: VmPayload = {};
        let vmStatus: "online" | "offline" | "not_configured" = "not_configured";
        let vmError: string | null = null;

        if (!monitor) {
          vmError = "Set ORACLE_VM_MONITOR_URL and ORACLE_VM_MONITOR_SECRET to stream CPU/RAM/disk metrics.";
        } else {
          try {
            const response = await fetch(`${monitor.url}/stats`, {
              headers: { Authorization: `Bearer ${monitor.secret}` },
              signal: AbortSignal.timeout(4000),
              cache: "no-store",
            });
            if (!response.ok) throw new Error(`VM monitor returned HTTP ${response.status}`);
            vm = (await response.json()) as VmPayload;
            vmStatus = "online";
          } catch (error) {
            vmStatus = "offline";
            vmError = error instanceof Error ? error.message : "VM monitor unreachable";
          }
        }

        const lk = getLiveKitApi();
        const livekit = {
          status: "not_configured" as "online" | "offline" | "not_configured",
          url: lk?.wsUrl ?? null,
          secure: lk ? /^wss:\/\//i.test(lk.wsUrl) : false,
          latencyMs: null as number | null,
          activeRooms: 0,
          activeParticipants: 0,
          activePublishers: 0,
          bandwidthMbps: Number(vm.livekit?.bandwidthMbps ?? (vm.network as { egressMbps?: number } | undefined)?.egressMbps ?? 0),
          cpuUsagePercent: Number(vm.livekit?.cpuUsagePercent ?? vm.server?.cpuUsagePercent ?? 0),
          metricsAvailable: Boolean(vm.livekit?.metricsAvailable),
          error: null as string | null,
          rooms: [] as { name: string; participants: number; publishers: number; createdAt: string | null; activeRecording: boolean }[],
        };

        if (!lk) {
          livekit.error = "LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not configured.";
        } else {
          const started = Date.now();
          try {
            const rooms = await lk.api.room.listRooms();
            livekit.latencyMs = Date.now() - started;
            livekit.status = "online";
            livekit.activeRooms = rooms.length;
            livekit.activeParticipants = rooms.reduce((sum, room) => sum + Number(room.numParticipants ?? 0), 0);
            livekit.activePublishers = rooms.reduce((sum, room) => sum + Number(room.numPublishers ?? 0), 0);
            livekit.rooms = rooms
              .map((room) => ({
                name: String(room.name ?? ""),
                participants: Number(room.numParticipants ?? 0),
                publishers: Number(room.numPublishers ?? 0),
                createdAt: room.creationTime ? new Date(Number(room.creationTime) * 1000).toISOString() : null,
                activeRecording: Boolean(room.activeRecording),
              }))
              .sort((a, b) => b.participants - a.participants)
              .slice(0, 50);
          } catch (error) {
            livekit.status = "offline";
            livekit.error = error instanceof Error ? error.message : "LiveKit room stats unavailable";
          }
        }

        const app = { liveRooms: 0, seatedUsers: 0, roomMembers: 0, error: null as string | null };
        try {
          const [live, seated, members] = await Promise.all([
            sb.from("live_rooms").select("id", { count: "exact", head: true }).eq("status", "live"),
            sb.from("room_members").select("id", { count: "exact", head: true }).not("seat_index", "is", null),
            sb.from("room_members").select("id", { count: "exact", head: true }),
          ]);
          app.liveRooms = live.count ?? 0;
          app.seatedUsers = seated.count ?? 0;
          app.roomMembers = members.count ?? 0;
        } catch (error) {
          app.error = error instanceof Error ? error.message : "App stats unavailable";
        }

        const cpu = Number(vm.server?.cpuUsagePercent ?? 0);
        const memory = Number(vm.server?.memoryUsagePercent ?? 0);
        const disk = Number(vm.server?.diskUsagePercent ?? 0);
        const thresholds = { cpuWarn: 60, cpuCritical: 80, memoryWarn: 70, memoryCritical: 85, diskWarn: 80, diskCritical: 90 };

        let statusColor: "green" | "yellow" | "red" = "green";
        let recommendation = "Optimal: current headroom looks healthy for additional traffic.";
        if (livekit.status === "offline") {
          statusColor = "red";
          recommendation = "LiveKit media server is not answering — voice rooms cannot connect until it is back online.";
        } else if (cpu >= thresholds.cpuCritical || memory >= thresholds.memoryCritical || disk >= thresholds.diskCritical) {
          statusColor = "red";
          recommendation = "Upgrade recommended: sustained high resource usage leaves too little headroom for peak traffic.";
        } else if (vmStatus === "offline") {
          statusColor = "yellow";
          recommendation = "LiveKit is live, but the VM metrics agent is unreachable — CPU/RAM/disk figures are stale.";
        } else if (cpu >= thresholds.cpuWarn || memory >= thresholds.memoryWarn || disk >= thresholds.diskWarn) {
          statusColor = "yellow";
          recommendation = "Moderate load: usable, but plan capacity before a major growth spike.";
        } else if (vmStatus === "not_configured") {
          statusColor = "yellow";
          recommendation = "LiveKit is reachable. Configure the VM monitor agent to also see CPU, RAM and disk load.";
        }

        return json({
          vm: { status: vmStatus, error: vmError },
          server: {
            ...(vm.server ?? {}),
            loadAvg: (vm.server as { loadAvg?: number[] } | undefined)?.loadAvg ?? null,
            network: vm.network ?? null,
          },
          livekit,
          app,
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
