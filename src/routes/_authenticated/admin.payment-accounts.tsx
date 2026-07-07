import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payment-accounts")({
  component: PaymentAccounts,
});

type Setting = {
  key: string;
  value: Record<string, string>;
};

const FIELDS = [
  { name: "jazzcash", label: "JazzCash number" },
  { name: "easypaisa", label: "Easypaisa number" },
  { name: "bankName", label: "Bank name" },
  { name: "bankAccount", label: "Bank account #" },
  { name: "bankTitle", label: "Bank account title" },
  { name: "crypto", label: "Crypto address (USDT/TRC20)" },
];

function PaymentAccounts() {
  const qc = useQueryClient();
  const setting = useQuery({
    queryKey: ["app_settings", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .eq("key", "payments")
        .maybeSingle();
      if (error) throw error;
      return (data ?? { key: "payments", value: {} }) as Setting;
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const current = { ...(setting.data?.value ?? {}), ...values };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").upsert({ key: "payments", value: current });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment accounts saved");
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      setValues({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Payment Accounts"
        subtitle="Deposit destinations shown to users on the recharge screen"
      />
      {setting.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="glass max-w-2xl rounded-2xl p-5">
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.name}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </label>
                <input
                  value={current[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      )}
    </>
  );
}
