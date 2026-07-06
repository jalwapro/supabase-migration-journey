import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
});

type Setting = {
  key: string;
  value: Record<string, string | number | boolean>;
  description: string | null;
  is_secret: boolean;
};

const KEY_LABELS: Record<string, { title: string; hint: string; fields: { name: string; label: string; type?: string; placeholder?: string }[] }> = {
  agora: {
    title: "Agora (Live Voice / Video)",
    hint: "Get these from console.agora.io → your project.",
    fields: [
      { name: "appId", label: "App ID", placeholder: "e.g. 4a3f…" },
      { name: "appCertificate", label: "App Certificate", placeholder: "primary certificate", type: "password" },
    ],
  },
  branding: {
    title: "Branding",
    hint: "Shown in headers and share previews.",
    fields: [
      { name: "appName", label: "App name" },
      { name: "tagline", label: "Tagline" },
    ],
  },
  payments: {
    title: "Manual Recharge Accounts",
    hint: "Users deposit here, then upload a screenshot. Admin approves.",
    fields: [
      { name: "jazzcash", label: "JazzCash number" },
      { name: "easypaisa", label: "Easypaisa number" },
      { name: "bankName", label: "Bank name" },
      { name: "bankAccount", label: "Bank account #" },
      { name: "bankTitle", label: "Bank account title" },
      { name: "crypto", label: "Crypto address (USDT/TRC20)" },
    ],
  },
  economy: {
    title: "Economy",
    hint: "Conversion rates and host share (0.6 = 60%).",
    fields: [
      { name: "pkrPerCoin", label: "PKR per 1 coin", type: "number" },
      { name: "pkrPerDiamond", label: "PKR per 1 diamond", type: "number" },
      { name: "hostGiftShare", label: "Host gift share (0–1)", type: "number" },
    ],
  },
};

function AdminPanel() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admins only");
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, navigate]);

  const settings = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value,description,is_secret");
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <AppShell title="Admin">
        <div className="p-6 text-center text-sm text-muted-foreground">Checking access…</div>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell
        title="Admin Panel"
        subtitle="Settings & moderation"
        right={
          <Link
            to="/me"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <div className="space-y-5 px-4 pt-4">
          <div className="flex items-center gap-2 rounded-2xl bg-[color:var(--gold)]/10 p-3 text-xs text-[color:var(--gold)]">
            <Shield className="h-4 w-4" />
            You have admin privileges. All secret keys are encrypted at rest via Supabase.
          </div>
          {settings.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          )}
          {(settings.data ?? []).map((s) => (
            <SettingCard key={s.key} setting={s} />
          ))}

          <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
            <p className="font-bold text-foreground">Coming soon in Admin</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>User management &amp; role grants</li>
              <li>Recharge approval queue</li>
              <li>Room moderation &amp; reports</li>
              <li>Banner &amp; category editor</li>
              <li>Gift catalog editor</li>
            </ul>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function SettingCard({ setting }: { setting: Setting }) {
  const qc = useQueryClient();
  const meta = KEY_LABELS[setting.key] ?? {
    title: setting.key,
    hint: setting.description ?? "",
    fields: Object.keys(setting.value ?? {}).map((k) => ({ name: k, label: k })),
  };
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      meta.fields.map((f) => [f.name, String(setting.value?.[f.name] ?? "")]),
    ),
  );

  const save = useMutation({
    mutationFn: async () => {
      const parsed: Record<string, string | number> = {};
      for (const f of meta.fields) {
        const v = values[f.name] ?? "";
        parsed[f.name] = f.type === "number" ? Number(v) || 0 : v;
      }
      const { error } = await supabase
        .from("app_settings")
        .update({ value: parsed })
        .eq("key", setting.key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${meta.title} saved`);
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-bold">{meta.title}</h3>
          {meta.hint && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.hint}</p>
          )}
        </div>
        {setting.is_secret && (
          <span className="shrink-0 rounded-full bg-[color:var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--gold)]">
            SECRET
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2.5">
        {meta.fields.map((f) => (
          <div key={f.name}>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
            </label>
            <input
              type={f.type ?? "text"}
              value={values[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </button>
    </div>
  );
}
