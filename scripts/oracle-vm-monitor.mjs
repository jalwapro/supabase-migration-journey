import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.VM_MONITOR_PORT || 8787);
const SECRET = process.env.ORACLE_VM_MONITOR_SECRET;
const LIVEKIT_METRICS_URL = process.env.LIVEKIT_METRICS_URL || "http://127.0.0.1:7880/metrics";

if (!SECRET) {
  console.error("ORACLE_VM_MONITOR_SECRET is required");
  process.exit(1);
}

let previousCpu = null;
let previousNetwork = null;
let previousNetworkAt = Date.now();

function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  }
  return { idle, total };
}

function cpuUsagePercent() {
  const current = cpuSnapshot();
  if (!previousCpu) {
    previousCpu = current;
    return Number(Math.min(100, (os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 100).toFixed(1));
  }
  const idleDelta = current.idle - previousCpu.idle;
  const totalDelta = current.total - previousCpu.total;
  previousCpu = current;
  if (totalDelta <= 0) return 0;
  return Number(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)).toFixed(1));
}

async function diskUsage() {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", "/"]);
    const line = stdout.trim().split("\n").at(-1) || "";
    const match = line.match(/\s(\d+)%\s+\//);
    return Number(match?.[1] ?? 0);
  } catch {
    return 0;
  }
}

function networkSnapshot() {
  const text = fs.readFileSync("/proc/net/dev", "utf8");
  let rx = 0;
  let tx = 0;
  for (const line of text.split("\n").slice(2)) {
    const [iface, values] = line.trim().split(":");
    if (!iface || iface === "lo" || !values) continue;
    const p = values.trim().split(/\s+/).map(Number);
    rx += p[0] || 0;
    tx += p[8] || 0;
  }
  return { rxBytes: rx, txBytes: tx };
}

function networkStats() {
  const now = Date.now();
  const current = networkSnapshot();
  if (!previousNetwork) {
    previousNetwork = current;
    previousNetworkAt = now;
    return { rxMbps: 0, txMbps: 0, totalMbps: 0 };
  }
  const seconds = Math.max((now - previousNetworkAt) / 1000, 0.001);
  const rxMbps = Math.max(0, (current.rxBytes - previousNetwork.rxBytes) * 8 / seconds / 1e6);
  const txMbps = Math.max(0, (current.txBytes - previousNetwork.txBytes) * 8 / seconds / 1e6);
  previousNetwork = current;
  previousNetworkAt = now;
  return { rxMbps: Number(rxMbps.toFixed(2)), txMbps: Number(txMbps.toFixed(2)), totalMbps: Number((rxMbps + txMbps).toFixed(2)) };
}

async function livekitMetrics() {
  try {
    const response = await fetch(LIVEKIT_METRICS_URL, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const bandwidthValues = [];
    for (const line of text.split("\n")) {
      if (line.startsWith("#") || !/livekit/i.test(line) || !/(bandwidth|bytes)/i.test(line)) continue;
      const match = line.match(/\s(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*$/i);
      if (match) bandwidthValues.push(Number(match[1]));
    }
    return { metricsAvailable: true, bandwidthMetricSamples: bandwidthValues.slice(0, 20) };
  } catch {
    return { metricsAvailable: false, bandwidthMetricSamples: [] };
  }
}

async function stats() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const network = networkStats();
  const cpu = cpuUsagePercent();
  const lkMetrics = await livekitMetrics();
  return {
    server: {
      hostname: os.hostname(),
      uptimeSeconds: Math.round(os.uptime()),
      uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
      cpuCores: os.cpus().length,
      cpuUsagePercent: cpu,
      memoryUsagePercent: Number(((usedMemory / totalMemory) * 100).toFixed(1)),
      totalMemoryMB: Math.round(totalMemory / 1048576),
      usedMemoryMB: Math.round(usedMemory / 1048576),
      diskUsagePercent: await diskUsage(),
      loadAvg: os.loadavg(),
    },
    network,
    livekit: {
      cpuUsagePercent: cpu,
      bandwidthMbps: network.totalMbps,
      ...lkMetrics,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" || req.url !== "/stats") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }
  if ((req.headers.authorization || "") !== `Bearer ${SECRET}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  try {
    const body = await stats();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "monitor error" }));
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`Oracle VM monitor listening on :${PORT}`));
