import { useState } from "react";
import { Mic, X, Loader2, ShieldAlert } from "lucide-react";

type Props = {
  open: boolean;
  /** Current permission state when the modal opens. */
  state: "prompt" | "denied" | "unknown";
  onClose: () => void;
  /** Called after user taps Allow and browser grants access. */
  onGranted: () => void;
};

/**
 * Premium in-app popup for microphone permission.
 * - state === "prompt"/"unknown": tapping Allow calls getUserMedia and triggers
 *   the browser prompt directly from the user gesture (required by browsers).
 * - state === "denied": shows step-by-step instructions to unblock in browser.
 */
export function MicPermissionModal({ open, state, onClose, onGranted }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const denied = state === "denied";

  async function allow() {
    setErr(null);
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setBusy(false);
      onGranted();
    } catch (e) {
      const err = e as DOMException;
      setBusy(false);
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setErr("Permission denied. Browser settings me Allow karo.");
      } else if (err?.name === "NotFoundError") {
        setErr("Koi microphone nahi mila.");
      } else if (err?.name === "NotReadableError") {
        setErr("Mic kisi aur app me use ho raha hai.");
      } else {
        setErr(err?.message || "Mic access denied");
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-md px-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-b from-background via-background to-[color:var(--secondary)]/10 p-6 text-center shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card/60 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--primary)]/25" />
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_10px_30px_-6px_rgba(236,72,153,0.6)]">
            {denied ? (
              <ShieldAlert className="h-9 w-9 text-white" />
            ) : (
              <Mic className="h-9 w-9 text-white" />
            )}
          </div>
        </div>

        <h2 className="mt-5 text-lg font-extrabold">
          {denied ? "Microphone Blocked" : "Allow Microphone"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {denied
            ? "Voice message bhejne ke liye mic access chahiye. Neeche diye steps se enable karo:"
            : "Voice message record karne ke liye Jalwa ko microphone allow karna hoga."}
        </p>

        {denied && (
          <ol className="mt-4 space-y-2 rounded-2xl border border-border bg-card/60 p-3 text-left text-xs text-muted-foreground">
            <li>
              <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-[color:var(--primary)]/20 text-[10px] font-black text-[color:var(--primary)]">1</span>
              Address bar me <b>🔒 lock icon</b> tap karo
            </li>
            <li>
              <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-[color:var(--primary)]/20 text-[10px] font-black text-[color:var(--primary)]">2</span>
              <b>Site settings</b> → <b>Microphone</b> → <b>Allow</b> select karo
            </li>
            <li>
              <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-[color:var(--primary)]/20 text-[10px] font-black text-[color:var(--primary)]">3</span>
              Page <b>reload</b> karke dubara try karo
            </li>
          </ol>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
            {err}
          </p>
        )}

        {!denied && (
          <button
            onClick={allow}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground shadow-[0_10px_30px_-8px_rgba(236,72,153,0.6)] active:scale-[0.98] disabled:opacity-60 transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Allow Microphone
          </button>
        )}
        {denied && (
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground shadow-[0_10px_30px_-8px_rgba(236,72,153,0.6)] active:scale-[0.98] transition"
          >
            Reload Page
          </button>
        )}
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
