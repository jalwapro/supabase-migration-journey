# Oracle VM monitoring setup

The admin panel runs on Vercel, so Node's `os` module in the Vercel route would measure the Vercel function, **not** the Oracle Cloud VM. The monitor therefore uses a small agent running on the Oracle VM.

## 1. Enable LiveKit Prometheus metrics

Configure the LiveKit server with a Prometheus port (the monitor defaults to `6789`):

```yaml
prometheus_port: 6789
```

Keep port `6789` private. The monitor reads it over `127.0.0.1`.

## 2. Start the VM monitor

On the Oracle VM, from the application checkout:

```bash
export ORACLE_VM_MONITOR_SECRET='generate-a-long-random-secret'
export VM_MONITOR_PORT=8787
export LIVEKIT_METRICS_URL='http://127.0.0.1:6789/metrics'
npm run monitor:oracle
```

The agent exposes only `GET /stats` and requires `Authorization: Bearer <secret>`.

## 3. Put the monitor behind HTTPS

Do not expose port `8787` directly to the public internet. Use the existing Caddy/reverse-proxy setup (or another private HTTPS tunnel) and proxy a hostname such as `monitor.example.com` to `127.0.0.1:8787`.

Then set these **server-side Vercel variables**:

```text
ORACLE_VM_MONITOR_URL=https://monitor.example.com
ORACLE_VM_MONITOR_SECRET=<same-long-random-secret>
```

The existing LiveKit server variables are also required:

```text
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## 4. Admin page

The new page is available at `/admin/vm-server` and is also linked under **System → VM Server**.

It shows:
- Oracle VM CPU, RAM, disk and network throughput
- LiveKit active rooms and participants via the LiveKit Server SDK
- LiveKit packet bandwidth when Prometheus metrics are enabled
- VM/LiveKit CPU
- capacity headroom and upgrade recommendations
- automatic refresh every 10 seconds

The API is admin-only and never exposes LiveKit API credentials to the browser.
