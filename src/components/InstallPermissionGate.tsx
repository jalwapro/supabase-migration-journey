import { useEffect, useState } from "react";
import { Mic, Bell, MapPin, Loader2, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/native";
import { initFcmIfGranted } from "@/lib/fcm-client";

const PREVIEW_ONLY_PATHS = new Set(["/svga-preview", "/svga-frames-preview", "/frames-preview", "/lottie-preview"]);

type PermState = "idle" | "asking" | "granted" | "denied";
type PermKey = "mic" | "notifications" | "location";

const LABELS: Record<PermKey, { title: string; sub: string; Icon: typeof Mic }> = {
  mic: { title: "Microphone", sub: "Voice rooms & voice messages", Icon: Mic },
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
 * First-launch permission gate.
 * - Native (Capacitor APK/IPA): uses Capacitor plugins → permissions register
 *   in Android "App info → Permissions" and iOS Settings.
 * - Installed PWA (standalone): uses web APIs (site-level, not OS-level).
 * - Normal browser tab: hidden.
 */
export function InstallPermissionGate() {
  const { user, loading: authLoading } = useAuth();
  const [needsAsk, setNeedsAsk] = useState(false);
  const [states, setStates] = useState<Record<PermKey, PermState>>({
    mic: "idle", notifications: "idle", location: "idle",
  });
  const [busy, setBusy] = useState(false);
  const PERMISSION_GATE_KEY = "jalwa_permission_gate_completed_v2";

  useEffect(() => {
    if (typeof window === "undefined" || authLoading || !user?.id) {
      setNeedsAsk(false);
      return;
    }
    if (PREVIEW_ONLY_PATHS.has(window.location.pathname)) return;
    // Once the user has completed the in-app permission gate, do not show it
    // again on every room/app render. Individual OS permissions are still
    // requested only when a feature actually needs them.
    if (window.localStorage.getItem(PERMISSION_GATE_KEY) === "1") {
      setNeedsAsk(false);
      return;
    }
    if (window.location.pathname === "/splash" || window.location.pathname === "/privacy" || window.location.pathname === "/terms") {
      setNeedsAsk(false);
      return;
    }

    let cancelled = false;

    const readPermissions = async () => {
      const next: Record<PermKey, PermState> = {
        mic: "idle",
        notifications: "idle",
        location: "idle",
      };

      try {
        if (isNative()) {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const push = await PushNotifications.checkPermissions();
          next.notifications = push.receive === "granted" ? "granted" : "idle";

          const { Geolocation } = await import("@capacitor/geolocation");
          const geo = await Geolocation.checkPermissions();
          next.location = geo.location === "granted" ? "granted" : "idle";
        } else {
          if ("Notification" in window && Notification.permission === "granted") {
            next.notifications = "granted";
          }
          if ("permissions" in navigator) {
            try {
              const mic = await navigator.permissions.query({ name: "microphone" as PermissionName });
              next.mic = mic.state === "granted" ? "granted" : "idle";
            } catch {}
            try {
              const geo = await navigator.permissions.query({ name: "geolocation" as PermissionName });
              next.location = geo.state === "granted" ? "granted" : "idle";
            } catch {}
          }
        }
      } catch {}

      if (cancelled) return;
      setStates(next);
      // Do not treat native microphone as perpetually "idle": this gate cannot
      // reliably query Android mic state from the WebView. The mic permission
      // is requested by the voice-room feature when it is actually needed.
      const nativeGatePending = isNative()
        ? next.notifications !== "granted" || next.location !== "granted"
        : Object.values(next).some((state) => state !== "granted");
      setNeedsAsk(nativeGatePending);

      // A previously granted Android notification permission must still
      // register/refresh the FCM token on every app start. Without this,
      // a user who closes the app can have no current native FCM subscription.
      if (next.notifications === "granted" && user?.id) {
        void initFcmIfGranted(user.id).catch((error) => {
          console.warn("FCM startup registration failed", error);
        });
      }
    };

    void readPermissions();
    const onFocus = () => void readPermissions();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id, authLoading]);
  function setOne(k: PermKey, s: PermState) {
    setStates((prev) => ({ ...prev, [k]: s }));
  }

  async function askMic(): Promise<void> {
    setOne("mic", "asking");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no mic");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setOne("mic", "granted");
    } catch { setOne("mic", "denied"); }
  }



  /**
   * Ask mic + camera in ONE getUserMedia call — mobile browsers (Chrome
   * Android, Samsung Internet) consume the user gesture with the first
   * prompt, so a second getUserMedia after `await` silently fails. A
   * combined `{audio, video}` prompt covers both with a single gesture.
   * Falls back to individual asks on failure.
   */


  async function askNotifications(): Promise<void> {
    setOne("notifications", "asking");
    try {
      if (isNative()) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const res = await PushNotifications.requestPermissions();
        const granted = res.receive === "granted";
        setOne("notifications", granted ? "granted" : "denied");
        if (granted && user?.id) {
          await initFcmIfGranted(user.id);
        }
        return;
      }
      if (!("Notification" in window)) throw new Error("no notif");
      const perm = await Notification.requestPermission();
      setOne("notifications", perm === "granted" ? "granted" : "denied");
    } catch { setOne("notifications", "denied"); }
  }

  async function askLocation(): Promise<void> {
    setOne("location", "asking");
    try {
      if (isNative()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const res = await Geolocation.requestPermissions();
        setOne("location", res.location === "granted" ? "granted" : "denied");
        return;
      }
      if (!("geolocation" in navigator)) throw new Error("no geo");
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => { setOne("location", "granted"); resolve(); },
          () => { setOne("location", "denied"); resolve(); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
        );
      });
    } catch { setOne("location", "denied"); }
  }

  async function askOne(k: PermKey): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      if (k === "mic") await askMic();
      else if (k === "notifications") await askNotifications();
      else await askLocation();
    } finally {
      setBusy(false);
    }
  }

  async function askAll() {
    // Keep each request in the same visible gate. Native/mobile OS prompts are
    // more reliable when each permission can also be launched by its own button.
    for (const key of ["mic", "notifications", "location"] as PermKey[]) {
      if (states[key] !== "granted") await askOne(key);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    // The gate has completed its one-time flow. Do not reopen it merely because
    // Android/WebView cannot report microphone state here.
    window.localStorage.setItem(PERMISSION_GATE_KEY, "1");
    setNeedsAsk(false);
  }
  function skip() {
    window.localStorage.setItem(PERMISSION_GATE_KEY, "1");
    setNeedsAsk(false);
  }

  if (!needsAsk) return null;

  return (
    <div className="fixed inset-0 z-[2147483600] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-6">
      <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-b from-background via-background to-[color:var(--secondary)]/10 p-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--primary)]/25" />
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_10px_30px_-6px_rgba(236,72,153,0.6)]">
            <Bell className="h-8 w-8 text-white" />
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
                <button
                  type="button"
                  onClick={() => void askOne(k)}
                  disabled={busy || st === "granted"}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-extrabold text-foreground disabled:opacity-50"
                >
                  {st === "asking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : st === "granted" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : "Allow"}
                </button>
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
          Agar kisi permission ko pehle deny kiya hai to Android App info → Permissions se bhi enable kar sakte ho
        </p>
      </div>
    </div>
  );
}
