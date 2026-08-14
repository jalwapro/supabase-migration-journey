import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, LockKeyhole, Save, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { uploadFileAtPath } from "@/lib/uploads";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin/payment-accounts")({ component: PaymentAccounts });

type Payments = Record<string, string | boolean>;
const DEFAULT_JAZZCASH_QR = "/payment-qr/jazzcash-merchant-qr.svg";
const DEFAULT_JAZZCASH_TILL = "984021661";
const DEFAULT_JAZZCASH_TITLE = "JALWA PRO";
const DEFAULT_JAZZCASH_IPN = "https://jalwa.pro/api/jazzcash/ipn";
const PAYMENT_VERIFIED_EMAIL = "mr3324333770@gmail.com";
const PAYMENT_VERIFICATION_KEY = "jalwa.payment-accounts.google-verified-at";
const PAYMENT_VERIFICATION_TTL_MS = 15 * 60 * 1000;

function PaymentAccounts() {
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [googleVerified, setGoogleVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const authorizedEmail = user?.email?.toLowerCase() === PAYMENT_VERIFIED_EMAIL;
  const googleProvider =
    user?.app_metadata?.provider === "google" ||
    (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes("google"));

  useEffect(() => {
    if (authLoading) return;

    const params = new URLSearchParams(window.location.search);
    const returnedFromGoogle = params.get("google_payment_verification") === "1";

    if (returnedFromGoogle) {
      window.history.replaceState({}, document.title, window.location.pathname);
      if (authorizedEmail && googleProvider) {
        sessionStorage.setItem(PAYMENT_VERIFICATION_KEY, String(Date.now()));
        setGoogleVerified(true);
        setVerificationError(null);
      } else {
        sessionStorage.removeItem(PAYMENT_VERIFICATION_KEY);
        setGoogleVerified(false);
        setVerificationError(
          authorizedEmail
            ? "Google verification was not completed. Please try again."
            : "Access denied. Only the authorized Google account can open Payment Accounts.",
        );
      }
      return;
    }

    const verifiedAt = Number(sessionStorage.getItem(PAYMENT_VERIFICATION_KEY) || 0);
    const fresh = verifiedAt > 0 && Date.now() - verifiedAt < PAYMENT_VERIFICATION_TTL_MS;
    setGoogleVerified(Boolean(authorizedEmail && googleProvider && fresh));
    if (!authorizedEmail) {
      sessionStorage.removeItem(PAYMENT_VERIFICATION_KEY);
      setVerificationError("Access denied. Only the authorized Google account can open Payment Accounts.");
    } else if (!fresh || !googleProvider) {
      setVerificationError(null);
    }
  }, [authLoading, authorizedEmail, googleProvider]);

  const verifyWithGoogle = async () => {
    setVerificationError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin/payment-accounts?google_payment_verification=1`,
        queryParams: {
          prompt: "login",
        },
      },
    });
    if (error) setVerificationError(error.message);
  };

  const setting = useQuery({
    queryKey: ["app_kv", "payments"],
    enabled: googleVerified,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_kv").select("key,value").eq("key", "payments").maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as Payments;
    },
  });

  const [values, setValues] = useState<Payments>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (setting.data) {
      setValues({
        ...setting.data,
        jazzcashQrUrl: setting.data.jazzcashQrUrl || DEFAULT_JAZZCASH_QR,
        jazzcashTillId: setting.data.jazzcashTillId || DEFAULT_JAZZCASH_TILL,
        jazzcashTitle: setting.data.jazzcashTitle || DEFAULT_JAZZCASH_TITLE,
        jazzcashIpnUrl: setting.data.jazzcashIpnUrl || DEFAULT_JAZZCASH_IPN,
        jazzcashApiEnabled: setting.data.jazzcashApiEnabled ?? false,
        jazzcashApiMode: setting.data.jazzcashApiMode || "Mobile Account",
      });
    }
  }, [setting.data]);

  const uploadQr = async (file: File, method: "easypaisa" | "jazzcash") => {
    if (!googleVerified) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast.error("QR must be PNG, JPG or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("QR image must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const url = await uploadFileAtPath("payment-qr", `${method}/merchant-qr.${ext}`, file);
      setValues((v) => ({ ...v, [`${method}QrUrl`]: url }));
      toast.success(`${method === "easypaisa" ? "Easypaisa" : "JazzCash"} QR uploaded to Cloudflare R2`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "QR upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!googleVerified) throw new Error("Google verification is required before saving payment settings.");
      const { error } = await supabase.from("app_kv").upsert({ key: "payments", value: values });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment accounts saved");
      qc.invalidateQueries({ queryKey: ["app_kv", "payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || (!googleVerified && authorizedEmail && verificationError === null && !user)) {
    return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (!googleVerified) {
    return (
      <div>
        <AdminPageHeader title="Payment Accounts" subtitle="Google verification required for payment configuration" />
        <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-border bg-card/80 p-8 text-center shadow-xl backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-black">Payment Accounts are protected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue with Google using <b>{PAYMENT_VERIFIED_EMAIL}</b>. Google will handle the account's own 2-Step Verification challenge when required.
          </p>
          {verificationError && (
            <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mr-2 inline h-4 w-4" />{verificationError}
            </div>
          )}
          <button
            type="button"
            onClick={() => void verifyWithGoogle()}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <GoogleIcon className="h-4 w-4" /> Verify with Google
          </button>
          <p className="mt-4 text-[11px] text-muted-foreground">Only this Google account is allowed. Other admin pages are not affected.</p>
        </div>
      </div>
    );
  }

  if (setting.isLoading) {
    return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (setting.isError) {
    return (
      <div>
        <AdminPageHeader title="Payment Accounts" subtitle="Manual deposit destinations and automatic payment gateway configuration" />
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
          <AlertCircle className="mr-2 inline h-5 w-5" />
          Unable to load payment settings. {setting.error instanceof Error ? setting.error.message : "Please try again."}
        </div>
      </div>
    );
  }

  const easypaisaQrUrl = String(values.easypaisaQrUrl || "");
  const jazzcashQrUrl = String(values.jazzcashQrUrl || DEFAULT_JAZZCASH_QR);
  const apiEnabled = Boolean(values.jazzcashApiEnabled);

  return (
    <div>
      <AdminPageHeader title="Payment Accounts" subtitle="Manual QR deposits and automatic gateway configuration" />
      <div className="space-y-5">
        <section className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="text-base font-black">Easypaisa Manual QR</h2>
          <p className="mt-1 text-xs text-muted-foreground">Upload the merchant QR to Cloudflare R2. Users will see this QR during manual recharge.</p>
          <div className="mt-4 space-y-4">
            {easypaisaQrUrl && <div className="rounded-2xl border border-border bg-white p-4"><img src={easypaisaQrUrl} alt="Easypaisa merchant QR" className="mx-auto h-72 w-72 max-w-full object-contain" /></div>}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload Easypaisa QR"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f, "easypaisa"); e.currentTarget.value = ""; }} />
            </label>
            <label className="block text-xs">QR Code Image URL<input value={easypaisaQrUrl} onChange={(e) => setValues((v) => ({ ...v, easypaisaQrUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="https://..." /></label>
            <label className="block text-xs">Merchant Till ID<input value={String(values.easypaisaTillId ?? "MR-14442")} onChange={(e) => setValues((v) => ({ ...v, easypaisaTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs">Account Title<input value={String(values.easypaisaTitle ?? "Jalwa Pro")} onChange={(e) => setValues((v) => ({ ...v, easypaisaTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
          </div>
        </section>

        <section className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="text-base font-black">JazzCash Manual QR</h2>
          <p className="mt-1 text-xs text-muted-foreground">Jalwa Pro JazzCash merchant QR. Upload a replacement to Cloudflare R2 if needed.</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-white p-4"><img src={jazzcashQrUrl} alt="JazzCash merchant QR" className="mx-auto h-72 w-72 max-w-full object-contain" /></div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload JazzCash QR to R2
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f, "jazzcash"); e.currentTarget.value = ""; }} />
            </label>
            <label className="block text-xs">JazzCash QR URL<input value={jazzcashQrUrl} onChange={(e) => setValues((v) => ({ ...v, jazzcashQrUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs">JazzCash Till / Merchant ID<input value={String(values.jazzcashTillId ?? DEFAULT_JAZZCASH_TILL)} onChange={(e) => setValues((v) => ({ ...v, jazzcashTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs">Account Title<input value={String(values.jazzcashTitle ?? DEFAULT_JAZZCASH_TITLE)} onChange={(e) => setValues((v) => ({ ...v, jazzcashTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
          </div>
        </section>

        <section className="glass max-w-2xl rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black">JazzCash Automatic API</h2>
              <p className="mt-1 text-xs text-muted-foreground">Configure the real Mobile Account gateway. Secrets are never stored in this admin form.</p>
            </div>
            <button type="button" onClick={() => setValues((v) => ({ ...v, jazzcashApiEnabled: !Boolean(v.jazzcashApiEnabled) }))} className={`rounded-full px-4 py-2 text-xs font-bold ${apiEnabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {apiEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block text-xs">API Mode<input value={String(values.jazzcashApiMode || "Mobile Account")} onChange={(e) => setValues((v) => ({ ...v, jazzcashApiMode: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Mobile Account" /></label>
            <label className="block text-xs">Payment API URL<input value={String(values.jazzcashApiUrl || "")} onChange={(e) => setValues((v) => ({ ...v, jazzcashApiUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="https://..." /></label>
            <label className="block text-xs">Merchant ID<input value={String(values.jazzcashMerchantId || "")} onChange={(e) => setValues((v) => ({ ...v, jazzcashMerchantId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="JazzCash Merchant ID" /></label>
            <label className="block text-xs">Merchant MSISDN<input value={String(values.jazzcashMerchantMsisdn || "")} onChange={(e) => setValues((v) => ({ ...v, jazzcashMerchantMsisdn: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="923xxxxxxxxx" /></label>
            <label className="block text-xs">IPN / Return URL<input value={String(values.jazzcashIpnUrl || DEFAULT_JAZZCASH_IPN)} onChange={(e) => setValues((v) => ({ ...v, jazzcashIpnUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-amber-400" />Merchant password and Integrity/SecureHash Salt must remain backend-only Supabase secrets. Add them in the Supabase Edge Function secrets; they are intentionally not exposed in the admin/browser.</div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">Backend secret names: <b>JAZZCASH_API_URL</b>, <b>JAZZCASH_MERCHANT_ID</b>, <b>JAZZCASH_PASSWORD</b>, <b>JAZZCASH_INTEGRITY_SALT</b>.</div>
          </div>
        </section>

        <section className="glass max-w-2xl rounded-2xl p-5">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Manual QR payments require admin verification before coins are credited. Automatic payments require verified JazzCash success/IPN before coins are credited.</div>
          <button onClick={() => save.mutate()} disabled={save.isPending || uploading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Payment Accounts
          </button>
        </section>
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
