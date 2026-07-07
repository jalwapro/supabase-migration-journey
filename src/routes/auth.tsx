import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, KeyRound, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jalwaLogo from "@/assets/jalwa-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Jalwa" },
      {
        name: "description",
        content:
          "Sign in or create your verified Jalwa account with email OTP or Google.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "otp" | "password";
type OtpStep = "email" | "code";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("otp");
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  function resetAlerts() {
    setErr(null);
    setMsg(null);
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setOtpStep("code");
      setMsg("We sent a 6-digit login code to your email.");
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function passwordSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();
    setBusy(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setBusy(false);
      if (error) setErr(error.message);
      else setMsg("Check your email to verify your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setErr(error.message);
    }
  }

  async function oauth(provider: "google" | "apple") {
    resetAlerts();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 flex items-center justify-center">
      {/* neon glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 40% at 20% 10%, color-mix(in oklab, var(--primary) 30%, transparent) 0%, transparent 60%), radial-gradient(50% 40% at 90% 20%, color-mix(in oklab, var(--secondary) 30%, transparent) 0%, transparent 60%), radial-gradient(60% 50% at 50% 100%, color-mix(in oklab, var(--accent) 25%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <img
              src={jalwaLogo.url}
              alt="Jalwa"
              className="h-16 w-16 rounded-2xl object-cover shadow-lg"
            />
            <h1 className="mt-4 text-2xl font-bold text-gradient">
              Welcome to Jalwa
            </h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Verified sign-in — real accounts only.
            </p>
          </div>

          {/* Social */}
          <div className="mt-6 grid gap-2.5">
            <button
              type="button"
              onClick={() => oauth("google")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3 font-medium hover:bg-muted transition-colors"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => oauth("apple")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3 font-medium hover:bg-muted transition-colors"
            >
              <AppleIcon className="h-4 w-4" />
              Continue with Apple
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            or
            <div className="flex-1 h-px bg-border" />
          </div>

          {mode === "otp" ? (
            <form
              onSubmit={otpStep === "email" ? sendOtp : verifyOtp}
              className="space-y-3"
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  disabled={otpStep === "code"}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base pl-10 disabled:opacity-60"
                />
              </div>

              {otpStep === "code" && (
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="input-base pl-10 tracking-[0.5em] text-center font-semibold"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="glow-4d w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {otpStep === "email" ? "Send login code" : "Verify & continue"}
              </button>

              {otpStep === "code" && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep("email");
                    setOtp("");
                    resetAlerts();
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  Use a different email
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={passwordSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base pl-10"
                />
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pl-10"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="glow-4d w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignUp ? "Create account" : "Sign in"}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsSignUp((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isSignUp ? "Have an account? Sign in" : "New here? Sign up"}
                </button>
                <Link
                  to="/reset-password"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "otp" ? "password" : "otp"));
              setOtpStep("email");
              setOtp("");
              setPassword("");
              resetAlerts();
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "otp" ? "Use password instead" : "Use email code instead"}
          </button>

          {err && (
            <p className="mt-4 text-sm text-destructive text-center">{err}</p>
          )}
          {msg && <p className="mt-4 text-sm text-gold text-center">{msg}</p>}
        </div>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16.365 12.86c-.02-2.09 1.71-3.09 1.78-3.14-.97-1.42-2.48-1.62-3.02-1.64-1.29-.13-2.51.76-3.16.76-.65 0-1.66-.74-2.73-.72-1.4.02-2.7.82-3.42 2.07-1.46 2.53-.37 6.28 1.05 8.34.7 1 1.52 2.13 2.6 2.09 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.71.65 1.12-.02 1.83-1.02 2.51-2.02.79-1.16 1.12-2.29 1.14-2.35-.03-.01-2.18-.84-2.2-3.33zM14.3 6.65c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.24-.53.61-1 1.59-.87 2.53.92.07 1.86-.47 2.43-1.17z" />
    </svg>
  );
}
