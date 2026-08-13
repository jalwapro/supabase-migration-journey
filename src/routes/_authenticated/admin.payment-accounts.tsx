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
  const [gateway, setGateway] = useState({ enabled: false, environment: "sandbox", accountTitle: "", returnUrl: "", merchantId: "", storeId: "", hashKey: "", partnerUsername: "", partnerPassword: "", rsaPrivateKey: "" });
  const current = { ...(setting.data?.value ?? {}), ...values };
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_kv").upsert({ key: "payments", value: current });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment accounts saved"); qc.invalidateQueries({ queryKey: ["app_kv"] }); setValues({}); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveGateway = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("easypaisa-gateway", { body: { action: "save", config: { enabled: gateway.enabled, environment: gateway.environment, merchantId: gateway.merchantId, storeId: gateway.storeId, accountTitle: gateway.accountTitle, returnUrl: gateway.returnUrl }, secret: { merchantId: gateway.merchantId, storeId: gateway.storeId, hashKey: gateway.hashKey, partnerUsername: gateway.partnerUsername, partnerPassword: gateway.partnerPassword, rsaPrivateKey: gateway.rsaPrivateKey } } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Easypaisa gateway setup saved securely"); setGateway((v) => ({ ...v, hashKey: "", partnerPassword: "", rsaPrivateKey: "" })); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setGatewayValue = (key: keyof typeof gateway, value: string | boolean) => setGateway((v) => ({ ...v, [key]: value as never }));
  return (
    <>
      <AdminPageHeader title="Payment Accounts" subtitle="Deposit destinations and automatic payment gateway configuration" />
      <div className="space-y-5">
        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">Easypaisa Automatic Gateway</h2>
          <p className="mb-4 text-xs text-muted-foreground">Customers can pay through the Easypaisa hosted checkout. Gateway secrets are sent directly to the protected server-side function and are never returned to the browser after saving.</p>
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Admin-only secure credential storage. Start with Sandbox, test a real transaction, then switch to Production.</div>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span><b>Enable automatic Easypaisa</b><span className="block text-xs text-muted-foreground">When off, the existing manual Easypaisa flow remains available.</span></span><input type="checkbox" checked={gateway.enabled} onChange={(e) => setGatewayValue("enabled", e.target.checked)} /></label>
            <label className="block text-xs">Environment<select value={gateway.environment} onChange={(e) => setGatewayValue("environment", e.target.value)} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm"><option value="sandbox">Sandbox / Testing</option><option value="production">Production / Live</option></select></label>
            {([["merchantId","Merchant ID / Store merchant ID"],["storeId","Store ID"],["accountTitle","Merchant Account Title"],["returnUrl","Return URL (optional)"] ] as const).map(([key,label]) => <label key={key} className="block text-xs">{label}<input value={gateway[key]} onChange={(e) => setGatewayValue(key,e.target.value)} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>)}
            <div className="border-t border-border pt-3"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Private credentials</p>
              <label className="block text-xs">Hash Key<input type="password" autoComplete="new-password" value={gateway.hashKey} onChange={(e) => setGatewayValue("hashKey",e.target.value)} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Paste Easypaisa hash key" /></label>
              <label className="mt-3 block text-xs">Partner Username (Open API, if supplied)<input value={gateway.partnerUsername} onChange={(e) => setGatewayValue("partnerUsername",e.target.value)} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
              <label className="mt-3 block text-xs">Partner Password (Open API, if supplied)<input type="password" autoComplete="new-password" value={gateway.partnerPassword} onChange={(e) => setGatewayValue("partnerPassword",e.target.value)} className="mt-1 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" /></label>
              <label className="mt-3 block text-xs">RSA Private Key (optional)<textarea value={gateway.rsaPrivateKey} onChange={(e) => setGatewayValue("rsaPrivateKey",e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border bg-input px-3 py-2.5 text-sm" placeholder="Only if Easypaisa has enabled RSA signing for your merchant account" /></label>
            </div>
            <button onClick={() => saveGateway.mutate()} disabled={saveGateway.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saveGateway.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Easypaisa Gateway</button>
          </div>
        </div>

        <div className="glass max-w-2xl rounded-2xl p-5">
          <h2 className="mb-1 text-base font-black">Manual Payment Accounts</h2>
          <p className="mb-4 text-xs text-muted-foreground">Deposit destinations shown on the recharge screen when automatic gateway payment is not being used.</p>
          <div className="space-y-3">
            {FIELDS.map((f) => <div key={f.name}><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label><input value={current[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>)}
          </div>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Manual Accounts</button>
        </div>
      </div>
    </>
  );
}
