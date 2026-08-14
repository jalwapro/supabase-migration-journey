import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EMAIL = "mr3324333770@gmail.com";
const KEY = "jalwa.payment-accounts.totp-verified-at";
const TTL = 15 * 60 * 1000;
type Props = { children: ReactNode; onVerified: () => void };

async function call2fa(action: string, code?: string) {
  const { data, error } = await supabase.functions.invoke("payment-accounts-2fa", { body: { action, code } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function PaymentAccountsTwoFA({ children, onVerified }: Props) {
  const [loading, setLoading] = useState(true), [configured, setConfigured] = useState(false), [verified, setVerified] = useState(false);
  const [code, setCode] = useState(""), [secret, setSecret] = useState(""), [otpauth, setOtpauth] = useState(""), [qr, setQr] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        const email = user?.email?.toLowerCase() || null; setUserEmail(email);
        if (email !== ALLOWED_EMAIL) return;
        const stamp = Number(sessionStorage.getItem(KEY) || 0);
        if (stamp && Date.now() - stamp < TTL) { setVerified(true); onVerified(); return; }
        sessionStorage.removeItem(KEY);
        const status = await call2fa("status");
        if (active) setConfigured(Boolean(status.configured && status.enabled));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load 2FA status"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [onVerified]);

  if (userEmail !== ALLOWED_EMAIL) return <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm"><AlertCircle className="mr-2 inline h-5 w-5" />Access denied. Only {ALLOWED_EMAIL} can access Payment Accounts.</div>;
  if (loading) return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  const setup = async () => { setBusy(true); setError(""); try { const data = await call2fa("setup"); setSecret(data.secret); setOtpauth(data.otpauth); setQr(data.qrDataUrl || ""); } catch (e) { setError(e instanceof Error ? e.message : "2FA setup failed"); } finally { setBusy(false); } };
  const enable = async () => { if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from Google Authenticator."); return; } setBusy(true); setError(""); try { await call2fa("enable", code); setConfigured(true); setSecret(""); setOtpauth(""); setQr(""); setCode(""); setVerified(true); sessionStorage.setItem(KEY, String(Date.now())); onVerified(); } catch (e) { setError(e instanceof Error ? e.message : "Invalid Authenticator code"); } finally { setBusy(false); } };
  const verify = async () => { if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from Google Authenticator."); return; } setBusy(true); setError(""); try { await call2fa("verify", code); setVerified(true); sessionStorage.setItem(KEY, String(Date.now())); setCode(""); onVerified(); } catch (e) { setError(e instanceof Error ? e.message : "Invalid Authenticator code"); } finally { setBusy(false); } };
  if (verified) return <>{children}</>;

  return <div><div className="mx-auto mt-8 max-w-xl rounded-3xl border border-border bg-card/80 p-8 text-center shadow-xl backdrop-blur">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div>
    <h2 className="mt-5 text-xl font-black">Google Authenticator Verification</h2>
    <p className="mt-2 text-sm text-muted-foreground">Payment Accounts is protected by a 6-digit Google Authenticator code for <b>{ALLOWED_EMAIL}</b>.</p>
    {!configured && !secret && <button type="button" onClick={() => void setup()} disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Set up Google Authenticator</button>}
    {secret && <div className="mt-6 space-y-4 text-left"><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm font-bold">1. Scan this QR with Google Authenticator</p>{qr && <img src={qr} alt="Google Authenticator setup QR" className="mx-auto my-4 h-56 w-56 rounded-xl bg-white p-3" />}<p className="text-xs text-muted-foreground">Or enter the setup key manually:</p><div className="mt-3 break-all rounded-xl bg-background p-3 font-mono text-sm tracking-widest">{secret}</div><a href={otpauth} className="mt-3 inline-flex text-xs font-bold text-primary underline">Open Authenticator setup URI</a></div><label className="block text-sm font-medium">2. Enter the 6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border bg-input px-4 py-3 text-center font-mono text-xl tracking-[0.5em]" placeholder="000000" /></label><button type="button" onClick={() => void enable()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enable & Verify</button></div>}
    {configured && !secret && <div className="mt-6 space-y-4"><label className="block text-sm font-medium text-left">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") void verify(); }} className="mt-2 w-full rounded-xl border bg-input px-4 py-3 text-center font-mono text-xl tracking-[0.5em]" placeholder="000000" /></label><button type="button" onClick={() => void verify()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify & Open Payment Accounts</button></div>}
    {error && <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
    <p className="mt-4 text-[11px] text-muted-foreground">Only this account is allowed. Other Admin Panel pages are not affected.</p>
  </div></div>;
}
