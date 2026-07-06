import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Jalwa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg("Password reset link sent — check your email.");
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg("Password updated. You can now sign in.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <h1 className="text-2xl font-bold text-center mb-1">
          {isRecovery ? "Set new password" : "Reset password"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {isRecovery
            ? "Enter a new password for your Jalwa account."
            : "We'll email you a secure link to reset your password."}
        </p>

        {!isRecovery ? (
          <form onSubmit={sendLink} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
          <form onSubmit={updatePassword} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {err && <p className="mt-4 text-sm text-destructive text-center">{err}</p>}
        {msg && <p className="mt-4 text-sm text-gold text-center">{msg}</p>}

        <div className="mt-6 text-center text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
