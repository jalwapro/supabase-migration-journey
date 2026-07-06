import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Jalwa" },
      { name: "description", content: "Sign in or create your Jalwa account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg("Check your email to verify your account.");
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg("6-digit code sent to your email.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function google() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gradient">Jalwa</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Create · Share · Shine
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-full bg-muted mb-6 text-sm">
          {(["signin", "signup", "otp"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 rounded-full py-2 transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : m === "signup" ? "Sign up" : "OTP"}
            </button>
          ))}
        </div>

        {mode !== "otp" && (
          <form onSubmit={mode === "signin" ? signIn : signUp} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            {mode === "signin" && (
              <div className="text-right text-xs">
                <Link to="/reset-password" className="text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
            )}
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={otp ? verifyOtp : sendOtp} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="input-base tracking-[0.5em] text-center"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : otp ? "Verify code" : "Send OTP"}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          OR
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={google}
          className="w-full rounded-full border border-border bg-card py-3 font-medium hover:bg-muted"
        >
          Continue with Google
        </button>

        {err && (
          <p className="mt-4 text-sm text-destructive text-center">{err}</p>
        )}
        {msg && (
          <p className="mt-4 text-sm text-gold text-center">{msg}</p>
        )}
      </div>
    </div>
  );
}
