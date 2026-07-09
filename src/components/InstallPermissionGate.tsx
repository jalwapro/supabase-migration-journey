import { useEffect, useState } from "react";
import { Mic, Video, Loader2 } from "lucide-react";

const FLAG_KEY = "jalwa_install_perms_asked_v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const mm = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || mm;
}

/**
 * On first launch of the INSTALLED web app (PWA), ask for microphone
 * and camera permission before letting the user into the app.
 * Never shows in the browser tab — only inside the installed app shell.
 */
export function InstallPermissionGate() {
  const [needsAsk, setNeedsAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalone()) return;
    try {
      if (localStorage.getItem(FLAG_KEY) === "1") return;
    } catch { /* no-op */ }
    if (!navigator.mediaDevices?.getUserMedia) {
      try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* no-op */ }
      return;
    }
    setNeedsAsk(true);
  }, []);

  async function ask() {
    setBusy(true);
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // Try audio-only fallback if camera denied/absent
      try {
        const s2 = await navigator.mediaDevices.getUserMedia({ audio: true });
        s2.getTracks().forEach((t) => t.stop());
      } catch {
        setErr("Permissions denied. You can enable Mic & Camera later from your browser settings.");
      }
    } finally {
      try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* no-op */ }
      setBusy(false);
      setNeedsAsk(false);
    }
  }

  function skip() {
    try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* no-op */ }
    setNeedsAsk(false);
  }

  if (!needsAsk) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 backdrop-blur-md px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)]">
          <div className="flex gap-1.5 text-primary-foreground">
            <Mic className="h-6 w-6" />
            <Video className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-4 text-xl font-extrabold">Allow Mic & Camera</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jalwa needs microphone and camera access so you can join live voice & video rooms.
        </p>
        {err && <p className="mt-3 text-xs text-[color:var(--destructive)]">{err}</p>}
        <button
          onClick={ask}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Allow & Continue
        </button>
        <button
          onClick={skip}
          disabled={busy}
          className="mt-2 w-full rounded-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
