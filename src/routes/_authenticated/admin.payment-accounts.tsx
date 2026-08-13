import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payment-accounts")({ component: PaymentAccounts });

type Setting = { key: string; value: Record<string, string> };
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
  const [values, setValues] = useState<Record<string, string>>({});
  const [qr, setQr] = useState({ easypaisaQrUrl: "", easypaisaTillId: "", easypaisaTitle: "", jazzcashQrUrl: "", jazzcashTillId: "", jazzcashTitle: "" });
  const current = { ...(setting.data?.value ?? {}), ...values, ...qr };
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_kv").upsert({ key: "payments", value: current });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment accounts saved"); qc.invalidateQueries({ queryKey: ["app_kv"] }); setValues({}); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <AdminPageHeader title="Payment Accounts" subtitle="Manual deposit destinations and QR payment configuration" />
      <div className="space-y-5">
        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">Easypaisa Manual QR</h2>
          <p className="mb-4 text-xs text-muted-foreground">Upload your QR image somewhere public and paste its image URL below. Users will submit their transaction reference for admin verification.</p>
          <div className="space-y-3">
            <label className="block text-xs">QR Code Image URL<input value={qr.easypaisaQrUrl} onChange={(e) => setQr(v => ({ ...v, easypaisaQrUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="https://.../easypaisa-qr.png" /></label>
            <label className="block text-xs">Till ID<input value={qr.easypaisaTillId} onChange={(e) => setQr(v => ({ ...v, easypaisaTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="MR-14442" /></label>
            <label className="block text-xs">Account Title<input value={qr.easypaisaTitle} onChange={(e) => setQr(v => ({ ...v, easypaisaTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Jalwa Pro" /></label>
          </div>
        </div>

        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">JazzCash Manual QR</h2>
          <p className="mb-4 text-xs text-muted-foreground">Add the merchant QR image and receiving Till/merchant identifier. Payments remain pending until an admin verifies them.</p>
          <div className="space-y-3">
            <label className="block text-xs">QR Code Image URL<input value={qr.jazzcashQrUrl} onChange={(e) => setQr(v => ({ ...v, jazzcashQrUrl: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="https://.../jazzcash-qr.png" /></label>
            <label className="block text-xs">Till ID / Merchant ID<input value={qr.jazzcashTillId} onChange={(e) => setQr(v => ({ ...v, jazzcashTillId: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Your JazzCash Till ID" /></label>
            <label className="block text-xs">Account Title<input value={qr.jazzcashTitle} onChange={(e) => setQr(v => ({ ...v, jazzcashTitle: e.target.value }))} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Jalwa Pro" /></label>
          </div>
        </div>

        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">Other Payment Accounts</h2>
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Manual payments require admin verification before coins are credited.</div>
          <div className="space-y-3">
            {FIELDS.map((f) => <div key={f.name}><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label><input value={current[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>)}
          </div>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Payment Accounts</button>
        </div>
      </div>
    </>
  );
}
