import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "jalwaapplive@gmail.com";
const FINANCE_PATHS = [
  "/admin/coins",
  "/admin/recharge",
  "/admin/payment-accounts",
  "/admin/withdrawals",
  "/admin/partners",
  "/admin/free-accounts",
  "/admin/finance-reports",
];

export function isFinanceAdminPath(pathname: string) {
  return FINANCE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

async function call2FA(action: string, code?: string) {
  const { data, error } = await supabase.functions.invoke("payment-accounts-2fa", { body: { action, code } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function FinanceTwoFA({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const currentEmail = user?.email?.toLowerCase() || null;
        if (!active) return;
        setEmail(currentEmail);
        if (currentEmail !== ADMIN_EMAIL) return;
        const status = await call2FA("status");
        if (active) setConfigured(Boolean(status.configured && status.enabled));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load 2FA status");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (email !== ADMIN_EMAIL) {
    return <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm"><AlertCircle className="mr-2 inline h-5 w-5" />Access denied. Only {ADMIN_EMAIL} can access Finance.</div>;
  }

  if (loading) return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (verified) return <>{children}</>;

  const setup = async () => {
    setBusy(true); setError("");
    try {
      const data = await call2FA("setup");
      setSecret(data.secret || ""); setOtpauth(data.otpauth || ""); setQr(data.qrDataUrl || "");
    } catch (e) { setError(e instanceof Error ? e.message : "2FA setup failed"); }
    finally { setBusy(false); }
  };

  const verify = async (enable = false) => {
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from Google Authenticator."); return; }
    setBusy(true); setError("");
    try {
      await call2FA(enable ? "enable" : "verify", code);
      setConfigured(true); setVerified(true); setCode(""); setSecret(""); setOtpauth(""); setQr("");
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid Authenticator code"); }
    finally { setBusy(false); }
  };

  return <div><div className="mx-auto mt-8 max-w-xl rounded-3xl border border-border bg-card/80 p-8 text-center shadow-xl backdrop-blur">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div>
    <h2 className="mt-5 text-xl font-black">Finance 2-Step Verification</h2>
    <p className="mt-2 text-sm text-muted-foreground">All Finance pages are protected by Google Authenticator for <b>{ADMIN_EMAIL}</b>.</p>
    {!configured && !secret && <button type="button" onClick={() => void setup()} disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Set up Google Authenticator</button>}
    {secret && <div className="mt-6 space-y-4 text-left"><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm font-bold">1. Scan this QR with Google Authenticator</p>{qr && <img src={qr} alt="Google Authenticator setup QR" className="mx-auto my-4 h-56 w-56 rounded-xl bg-white p-3" />}<p className="text-xs text-muted-foreground">Or enter this setup key manually:</p><div className="mt-3 break-all rounded-xl bg-background p-3 font-mono text-sm tracking-widest">{secret}</div>{otpauth && <a href={otpauth} className="mt-3 inline-flex text-xs font-bold text-primary underline">Open Authenticator setup URI</a>}</div><label className="block text-sm font-medium">2. Enter the 6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border bg-input px-4 py-3 text-center font-mono text-xl tracking-[0.5em]" placeholder="000000" /></label><button type="button" onClick={() => void verify(true)} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enable & Open Finance</button></div>}
    {configured && !secret && <div className="mt-6 space-y-4"><label className="block text-sm font-medium text-left">Google Authenticator code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") void verify(); }} className="mt-2 w-full rounded-xl border bg-input px-4 py-3 text-center font-mono text-xl tracking-[0.5em]" placeholder="000000" /></label><button type="button" onClick={() => void verify()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify & Open Finance</button></div>}
    {error && <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
    <p className="mt-4 text-[11px] text-muted-foreground">This protection applies to Coin Management, Recharge, Payment Accounts, Withdrawals, Partners, Free Accounts and Finance Reports.</p>
  </div></div>;
}
