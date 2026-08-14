import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Save, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { uploadFileAtPath } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/admin/payment-accounts")({ component: PaymentAccounts });

type Payments = Record<string, string>;
const DEFAULT_JAZZCASH_QR = "/payment-qr/jazzcash-merchant-qr.svg";
const DEFAULT_JAZZCASH_TILL = "984021661";
const DEFAULT_JAZZCASH_TITLE = "JALWA PRO";

function PaymentAccounts() {
  const qc = useQueryClient();
  const setting = useQuery({
    queryKey: ["app_kv", "payments"],
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
      });
    }
  }, [setting.data]);

  const uploadQr = async (file: File, method: "easypaisa" | "jazzcash") => {
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
      const { error } = await supabase.from("app_kv").upsert({ key: "payments", value: values });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment accounts saved");
      qc.invalidateQueries({ queryKey: ["app_kv", "payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (setting.isLoading) {
    return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (setting.isError) {
    return (
      <div>
        <AdminPageHeader title="Payment Accounts" subtitle="Manual deposit destinations and QR payment configuration" />
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
          <AlertCircle className="mr-2 inline h-5 w-5" />
          Unable to load payment settings. {setting.error instanceof Error ? setting.error.message : "Please try again."}
        </div>
      </div>
    );
  }

  const easypaisaQrUrl = values.easypaisaQrUrl || "";
  const jazzcashQrUrl = values.jazzcashQrUrl || DEFAULT_JAZZCASH_QR;

  return (
    <div>
      <AdminPageHeader title="Payment Accounts" subtitle="Manual deposit destinations and QR payment configuration" />
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
            <label className="block text-xs">Merchant Till ID<input value={values.easypaisaTillId ?? "MR-14442"} onChange={(e) => setValues((v) => ({ ...v, easypaisaTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs">Account Title<input value={values.easypaisaTitle ?? "Jalwa Pro"} onChange={(e) => setValues((v) => ({ ...v, easypaisaTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
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
            <label className="block text-xs">JazzCash Till / Merchant ID<input value={values.jazzcashTillId ?? DEFAULT_JAZZCASH_TILL} onChange={(e) => setValues((v) => ({ ...v, jazzcashTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs">Account Title<input value={values.jazzcashTitle ?? DEFAULT_JAZZCASH_TITLE} onChange={(e) => setValues((v) => ({ ...v, jazzcashTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
          </div>
        </section>

        <section className="glass max-w-2xl rounded-2xl p-5">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Manual payments require admin verification before coins are credited.</div>
          <button onClick={() => save.mutate()} disabled={save.isPending || uploading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Payment Accounts
          </button>
        </section>
      </div>
    </div>
  );
}
