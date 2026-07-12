import { useEffect, useState } from "react";
import { Mic, Video, Bell, MapPin, Loader2, Check, X } from "lucide-react";

const FLAG_KEY = "jalwa_install_perms_asked_v2";

type PermState = "idle" | "asking" | "granted" | "denied";
type PermKey = "mic" | "camera" | "notifications" | "location";

const LABELS: Record<PermKey, { title: string; sub: string; Icon: typeof Mic }> = {
  mic: { title: "Microphone", sub: "Voice rooms & voice messages", Icon: Mic },
  camera: { title: "Camera", sub: "Video rooms & profile photos", Icon: Video },
  notifications: { title: "Notifications", sub: "New messages, gifts & follows", Icon: Bell },
  location: { title: "Location", sub: "Nearby rooms & regional ranks", Icon: MapPin },
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const mm = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || mm;
}

/**
 * First-launch permission gate for the installed PWA / WebAPK.
 * Sequentially requests Mic, Camera, Notifications, Location — so all four
 * appear (and can be toggled) in the OS "App info" screen after install.
 * Never shows in a normal browser tab.
 */
export function InstallPermissionGate() {
  const [needsAsk, setNeedsAsk] = useState(false);
  const [states, setStates] = useState<Record<PermKey, PermState>>({
    mic: "idle", camera: "idle", notifications: "idle", location: "idle",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalone()) return;
    try {
      if (localStorage.getItem(FLAG_KEY) === "1") return;
    } catch { /* no-op */ }
    setNeedsAsk(true);
  }, []);

  function setOne(k: PermKey, s: PermState) {
    setStates((prev) => ({ ...prev, [k]: s }));
  }

  async function askMic(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) { setOne("mic", "denied"); return; }
    setOne("mic", "asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setOne("mic", "granted");
    } catch { setOne("mic", "denied"); }
  }

  async function askCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) { setOne("camera", "denied"); return; }
    setOne("camera", "asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setOne("camera", "granted");
    } catch { setOne("camera", "denied"); }
  }

  async function askNotifications(): Promise<void> {
    if (!("Notification" in window)) { setOne("notifications", "denied"); return; }
    setOne("notifications", "asking");
    try {
      const perm = await Notification.requestPermission();
      setOne("notifications", perm === "granted" ? "granted" : "denied");
    } catch { setOne("notifications", "denied"); }
  }

  async function askLocation(): Promise<void> {
    if (!("geolocation" in navigator)) { setOne("location", "denied"); return; }
    setOne("location", "asking");
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { setOne("location", "granted"); resolve(); },
        () => { setOne("location", "denied"); resolve(); },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }

  async function askAll() {
    setBusy(true);
    // Sequential — some Android WebViews reject overlapping prompts.
    await askMic();
    await askCamera();
    await askNotifications();
    await askLocation();
    try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* no-op */ }
    setBusy(false);
    // Small delay so the user sees the final ticks before the gate closes.
    setTimeout(() => setNeedsAsk(false), 600);
  }

  function skip() {
    try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* no-op */ }
    setNeedsAsk(false);
  }

  if (!needsAsk) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 backdrop-blur-md px-6">
      <div className="w-full max-w-sm rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-b from-background via-background to-[color:var(--secondary)]/10 p-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--primary)]/25" />
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_10px_30px_-6px_rgba(236,72,153,0.6)]">
            <Mic className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-xl font-extrabold">Welcome to Jalwa</h2>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Best experience ke liye Jalwa ko yeh permissions do
        </p>

        <ul className="mt-5 space-y-2">
          {(Object.keys(LABELS) as PermKey[]).map((k) => {
            const { title, sub, Icon } = LABELS[k];
            const st = states[k];
            return (
              <li
                key={k}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--primary)]/20 to-[color:var(--secondary)]/20 text-[color:var(--primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
                </div>
                <div className="shrink-0">
                  {st === "asking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {st === "granted" && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {st === "denied" && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-red-500/15 text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button
          onClick={askAll}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground shadow-[0_10px_30px_-8px_rgba(236,72,153,0.6)] active:scale-[0.98] disabled:opacity-60 transition"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Requesting…" : "Allow All & Continue"}
        </button>
        <button
          onClick={skip}
          disabled={busy}
          className="mt-2 w-full rounded-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Baad me OS settings → App info → Permissions se bhi manage kar sakte ho
        </p>
      </div>
    </div>
  );
}
