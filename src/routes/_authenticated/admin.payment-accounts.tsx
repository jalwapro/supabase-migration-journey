import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Save, ShieldCheck, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { uploadFileAtPath } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/admin/payment-accounts")({ component: PaymentAccounts });

type Setting = { key: string; value: Record<string, string> };
const EASYPaisa_QR = "https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=00020101021128760032EpGdjILBmzzJ3USyc3wuXjD1SPLJ6fgN0108TMICFBPK0224PK92TMFB00000000129737895204539953035865802PK5909Jalwa%20pro6009Islamabad62530006OPS2.0030713951560506OPS2.007099992872990805Other64370002EN0114MUHAMMAD%20IHSAN0209Islamabad63040B31";

const FIELDS = [
  { name: "jazzcash", label: "JazzCash number" },
  { name: "easypaisa", label: "Easypaisa personal number" },
  { name: "easypaisaMerchantId", label: "Easypaisa Merchant ID" },
  { name: "easypaisaStoreId", label: "Easypaisa Store ID" },
  { name: "easypaisaAccountTitle", label: "Easypaisa merchant account title" },
  { name: "easypaisaIban", label: "Easypaisa merchant IBAN" },
  { name: "bankName", label: "Bank name" },
  { name: "bankAccount", label: "Bank account #" },
  { name: "bankTitle", label: "Bank account title" },
  { name: "crypto", label: "Crypto address (USDT/TRC20)" },
  { name: "paypal", label: "PayPal email / handle" },
  { name: "paypalNote", label: "PayPal instructions (optional)" },
];

function PaymentAccounts() {
  const qc = useQueryClient();
  const setting = useQuery({
    queryKey: ["app_kv", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_kv").select("key,value").eq("key", "payments").maybeSingle();
      if (error) throw error;
      return (data ?? { key: "payments", value: {} }) as Setting;
    },
  });
  const saved = setting.data?.value ?? {};
  const [values, setValues] = useState<Record<string, string>>({});
  const [qr, setQr] = useState({
    easypaisaQrUrl: saved.easypaisaQrUrl || EASYPaisa_QR,
    easypaisaTillId: saved.easypaisaTillId || "MR-14442",
    easypaisaTitle: saved.easypaisaTitle || "Jalwa Pro",
    jazzcashQrUrl: saved.jazzcashQrUrl || "",
    jazzcashTillId: saved.jazzcashTillId || "",
    jazzcashTitle: saved.jazzcashTitle || "",
  });
  const [uploading, setUploading] = useState<"easypaisa" | "jazzcash" | null>(null);
  const current = { ...saved, ...values, ...qr };

  const uploadQr = async (method: "easypaisa" | "jazzcash", file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("QR must be PNG, JPG or WEBP.");
    if (file.size > 5 * 1024 * 1024) throw new Error("QR image must be 5MB or smaller.");
    setUploading(method);
    try {
      const url = await uploadFileAtPath("payment-qr", `${method}/merchant-qr.${file.name.split(".").pop()?.toLowerCase() || "png"}`, file);
      setQr((v) => ({ ...v, [`${method}QrUrl`]: url }));
      toast.success(`${method === "easypaisa" ? "Easypaisa" : "JazzCash"} QR uploaded to Cloudflare R2`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "QR upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_kv").upsert({ key: "payments", value: current });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment accounts saved"); qc.invalidateQueries({ queryKey: ["app_kv"] }); setValues({}); },
    onError: (e: Error) => toast.error(e.message),
  });

  const qrCard = (method: "easypaisa" | "jazzcash", label: string) => {
    const key = `${method}QrUrl` as keyof typeof qr;
    const url = qr[key];
    return (
      <div className="glass max-w-2xl rounded-2xl p-5">
        <h2 className="mb-1 text-base font-black">{label} Manual QR</h2>
        <p className="mb-4 text-xs text-muted-foreground">Upload the merchant QR directly to Cloudflare R2. The saved R2 URL is used by the app.</p>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              {uploading === method ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading === method ? "Uploading…" : `Upload ${label} QR`}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(method, f); e.currentTarget.value = ""; }} />
            </label>
            {url && <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><ImageIcon className="h-4 w-4" />QR configured</span>}
          </div>
          {url && <div className="rounded-2xl border border-border bg-white p-4"><img src={url} alt={`${label} merchant QR`} className="mx-auto block h-72 w-72 max-w-full object-contain" /></div>}
          <label className="block text-xs">QR Code Image URL<input value={url} onChange={(e) => setQr(v => ({ ...v, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs">{label === "Easypaisa" ? "Till ID" : "Till ID / Merchant ID"}<input value={method === "easypaisa" ? qr.easypaisaTillId : qr.jazzcashTillId} onChange={(e) => setQr(v => ({ ...v, [`${method}TillId`]: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder={method === "easypaisa" ? "MR-14442" : "Your JazzCash Till ID"} /></label>
          <label className="block text-xs">Account Title<input value={method === "easypaisa" ? qr.easypaisaTitle : qr.jazzcashTitle} onChange={(e) => setQr(v => ({ ...v, [`${method}Title`]: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Jalwa Pro" /></label>
        </div>
      </div>
    );
  };

  return (
    <>
      <AdminPageHeader title="Payment Accounts" subtitle="Manual deposit destinations and QR payment configuration" />
      <div className="space-y-5">
        {qrCard("easypaisa", "Easypaisa")}
        {qrCard("jazzcash", "JazzCash")}
        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">Other Payment Accounts</h2>
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Manual payments require admin verification before coins are credited.</div>
          <div className="space-y-3">{FIELDS.map((f) => <div key={f.name}><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label><input value={current[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>)}</div>
          <button onClick={() => save.mutate()} disabled={save.isPending || uploading !== null} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Payment Accounts</button>
        </div>
      </div>
    </>
  );
}
