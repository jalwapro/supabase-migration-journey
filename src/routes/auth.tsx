import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn, ErrorCode as GoogleErrorCode } from "@capawesome/capacitor-google-sign-in";
import { Mail, KeyRound, Loader2, Sparkles, ShieldAlert, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { JALWA_LOGO as jalwaLogo } from "@/lib/r2-static";

const JALWA_PRODUCTION_URL = "https://www.jalwa.pro/";
const NATIVE_OAUTH_REDIRECT = "app.lovable.jalwa://auth/callback";
// Web OAuth client from the jalwa-501900 Google Cloud project.
// The matching Android OAuth client must also exist in this project with
// package app.lovable.jalwa and the signing certificate SHA-1 for this build.
const GOOGLE_WEB_CLIENT_ID =
  "923506443706-bfroam18nheqfkdpfrhevd2tdgkt2pqj.apps.googleusercontent.com";

let googleSignInInitialized = false;

async function initializeGoogleSignIn() {
  if (googleSignInInitialized) return;
  await GoogleSignIn.initialize({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });
  googleSignInInitialized = true;
}

function getAuthRedirectUrl() {
  if (typeof window === "undefined") return JALWA_PRODUCTION_URL;
  if (Capacitor.isNativePlatform()) return NATIVE_OAUTH_REDIRECT;
  return `${window.location.origin}/`;
}

async function finishNativeOAuthUrl(url: string) {
  if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) return false;

  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return true;
    }

    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return true;
    }
  } catch (error) {
    console.error("[auth] Native OAuth callback failed", error);
    return false;
  }

  return false;
}

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
  const [banNotice, setBanNotice] = useState<{ userId: string; email: string; reason: string } | null>(null);
  const [appealEmail, setAppealEmail] = useState("");
  const [appealMessage, setAppealMessage] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("reason") !== "banned") return;
    try {
      const raw = localStorage.getItem("jalwa_ban_notice");
      if (raw) {
        const parsed = JSON.parse(raw) as { userId?: string; email?: string; reason?: string };
        if (parsed.userId) {
          setBanNotice({ userId: parsed.userId, email: parsed.email ?? "", reason: parsed.reason ?? "" });
          setAppealEmail(parsed.email ?? "");
          return;
        }
      }
    } catch {}
    setBanNotice({ userId: "", email: "", reason: "" });
  }, []);

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    setAppealError(null);
    setAppealBusy(true);
    try {
      const response = await fetch("/api/submit-ban-appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: banNotice?.userId, email: appealEmail.trim(), message: appealMessage.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ? String(result.error) + (result.detail ? ": " + String(result.detail) : "") : "Could not submit appeal.");
      setAppealSubmitted(true);
    } catch (error) {
      setAppealError(error instanceof Error ? error.message : "Could not submit appeal. Please try again.");
    } finally {
      setAppealBusy(false);
    }
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;
    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      const handled = await finishNativeOAuthUrl(url);
      if (mounted && handled) navigate({ to: "/" });
    });

    return () => {
      mounted = false;
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

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
      options: { emailRedirectTo: getAuthRedirectUrl() },
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
        options: { emailRedirectTo: getAuthRedirectUrl() },
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
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;
    } catch (error) {
      setErr(error instanceof Error ? error.message : `Continue with ${provider} failed. Please try again.`);
      setBusy(false);
    }
  }

  async function nativeGoogleSignIn() {
    resetAlerts();
    setBusy(true);

    try {
      if (!Capacitor.isNativePlatform()) {
        await oauth("google");
        return;
      }

      await initializeGoogleSignIn();
      const result = await GoogleSignIn.signIn();

      if (!result.idToken) {
        throw new Error("Google did not return an ID token.");
      }

      // Native Google returns the provider token directly. Give Supabase both
      // tokens when an access token is available; this also covers Google ID
      // tokens that contain an at_hash claim.
      const { data: authData, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.idToken,
        ...(result.accessToken ? { access_token: result.accessToken } : {}),
      });

      if (error) throw error;

      // Do not navigate until Supabase has actually persisted the session.
      // This prevents the authenticated route guard from racing the native
      // Google callback and sending the user straight back to /auth.
      let session: typeof authData.session | null = authData.session ?? null;
      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data.session ?? null;
      }

      if (!session?.user) {
        throw new Error("Google sign-in completed, but Jalwa could not restore the session. Please try again.");
      }

      // Let AuthProvider receive SIGNED_IN and hydrate profile/roles before
      // leaving the login screen.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      navigate({ to: "/", replace: true });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : String(error ?? "");

      // Capawesome/Google Play Services can surface an Android OAuth
      // configuration failure as SIGN_IN_CANCELED (for example
      // "Account reauth failed" / "UNREGISTERED_ON_API_CONSOLE"). Never hide
      // those errors as if the user simply pressed Cancel.
      const looksLikeConfigFailure =
        /reauth|unregistered_on_api_console|api console|configuration|credential/i.test(message);

      if (code !== GoogleErrorCode.SignInCanceled || looksLikeConfigFailure) {
        setErr(
          looksLikeConfigFailure
            ? "Google sign-in is not fully configured for this Android build. The Google account picker worked, but the Android app signing certificate is not registered for Jalwa."
            : message || "Google sign-in failed. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {banNotice && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[#05030a]/90 p-4 backdrop-blur-xl">
        <div role="dialog" aria-modal="true" aria-labelledby="ban-notice-title" className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-red-400/30 bg-[#110b17] p-6 text-white shadow-[0_25px_100px_rgba(0,0,0,0.7)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500" />
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><ShieldAlert className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <h2 id="ban-notice-title" className="text-xl font-bold">Your Account Has Been Banned</h2>
              <p className="mt-1 text-sm text-white/60">Your JALWA account access has been restricted by the moderation team.</p>
            </div>
            <button type="button" aria-label="Close ban notice" onClick={() => setBanNotice(null)} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-500/[0.07] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Ban reason</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/90">{banNotice.reason || "The moderation team has not provided a reason. You can submit an appeal below for clarification."}</p>
          </div>
          {appealSubmitted ? (
            <div role="status" className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
              <p className="font-semibold text-emerald-300">Appeal request submitted</p>
              <p className="mt-1 text-sm text-white/75">Your appeal request has been submitted. The JALWA team will review it.</p>
            </div>
          ) : (
            <form onSubmit={submitAppeal} className="mt-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/75">Account email</label>
                <input type="email" required value={appealEmail} onChange={(e) => setAppealEmail(e.target.value)} placeholder="Email used for this JALWA account" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-fuchsia-400" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/75">Appeal request</label>
                <textarea required minLength={10} maxLength={2000} rows={4} value={appealMessage} onChange={(e) => setAppealMessage(e.target.value)} placeholder="Explain why you believe this ban should be reviewed (10–2000 characters)." className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-fuchsia-400" />
              </div>
              {appealError && <p role="alert" className="text-sm text-red-300">{appealError}</p>}
              <button type="submit" disabled={appealBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fuchsia-500 px-4 py-3 text-sm font-bold text-white hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50">
                {appealBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {appealBusy ? "Submitting appeal…" : "Submit Appeal Request"}
              </button>
              {!banNotice.userId && <p className="text-xs text-amber-200">Account ID could not be restored on this device. Please enter the email linked to your banned JALWA account; support can verify your identity if needed.</p>}
            </form>
          )}
          <p className="mt-4 text-center text-[11px] leading-5 text-white/45">Submitting an appeal does not automatically remove the ban. Your account remains restricted while the appeal is reviewed.</p>
        </div>
      </div>
    )}
    <div className="relative min-h-screen overflow-hidden px-4 py-10 flex items-center justify-center">
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
            <img src={jalwaLogo} alt="Jalwa" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
            <h1 className="mt-4 text-2xl font-bold text-gradient">Welcome to Jalwa</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Verified sign-in — real accounts only.
            </p>
          </div>

          <div className="mt-6 grid gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetAlerts();
                void nativeGoogleSignIn();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3 font-medium hover:bg-muted transition-colors"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            or
            <div className="flex-1 h-px bg-border" />
          </div>

          {mode === "otp" ? (
            <form onSubmit={otpStep === "email" ? sendOtp : verifyOtp} className="space-y-3">
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
                <Link to="/reset-password" className="text-muted-foreground hover:text-foreground">
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

          {err && <p className="mt-4 text-sm text-destructive text-center">{err}</p>}
          {msg && <p className="mt-4 text-sm text-gold text-center">{msg}</p>}
        </div>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/" className="uppercase tracking-[0.25em] hover:text-foreground">
              ← Back to home
            </Link>
            <span aria-hidden>•</span>
            <Link to="/privacy" className="hover:text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
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
