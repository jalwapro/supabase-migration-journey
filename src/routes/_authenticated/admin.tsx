import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Shield, Loader2, Check, X, Plus, Trash2, Image as ImageIcon } from "lucide-react";
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

          <RechargeApprovals />
          <CoinPackagesEditor />

          <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
            <p className="font-bold text-foreground">Coming soon in Admin</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>User management &amp; role grants</li>
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

// -------------------- Recharge Approvals --------------------

type RechargeRow = {
  id: string;
  user_id: string;
  method: string;
  amount_pkr: number;
  coins_expected: number;
  proof_url: string | null;
  sender_name: string | null;
  sender_account: string | null;
  txn_reference: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_note: string | null;
};

function RechargeApprovals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const list = useQuery({
    queryKey: ["admin_recharges", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recharge_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as RechargeRow[];
    },
  });

  const act = useMutation({
    mutationFn: async ({
      id,
      approve,
      note,
    }: {
      id: string;
      approve: boolean;
      note?: string;
    }) => {
      const fn = approve ? "approve_recharge" : "reject_recharge";
      const { error } = await supabase.rpc(fn, {
        _request_id: id,
        _admin_note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved & coins credited" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin_recharges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">Recharge Approvals</h3>
      </div>
      <div className="mb-3 flex gap-1 rounded-full bg-card/60 p-1">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 text-xs font-bold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {list.isLoading && (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {list.data?.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">No {tab} recharges</p>
      )}
      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card/40 p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">
                  {r.coins_expected.toLocaleString()} coins · Rs{" "}
                  {Number(r.amount_pkr).toLocaleString()}
                </p>
                <p className="text-muted-foreground">
                  {r.method} · {new Date(r.created_at).toLocaleString()}
                </p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  User: {r.user_id}
                </p>
                {r.sender_name && <p>From: {r.sender_name}</p>}
                {r.sender_account && <p>Acct: {r.sender_account}</p>}
                {r.txn_reference && <p>Ref: {r.txn_reference}</p>}
                {r.note && <p className="text-muted-foreground">Note: {r.note}</p>}
                {r.admin_note && (
                  <p className="mt-1 text-[10px] text-[color:var(--gold)]">
                    Admin: {r.admin_note}
                  </p>
                )}
              </div>
              {r.proof_url ? (
                <a href={r.proof_url} target="_blank" rel="noreferrer" className="shrink-0">
                  <img
                    src={r.proof_url}
                    alt="proof"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-card/60">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            {tab === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: r.id, approve: true })}
                  className="flex-1 rounded-full bg-emerald-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Check className="mr-1 inline h-3 w-3" /> Approve
                </button>
                <button
                  disabled={act.isPending}
                  onClick={() => {
                    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                    act.mutate({ id: r.id, approve: false, note });
                  }}
                  className="flex-1 rounded-full bg-red-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <X className="mr-1 inline h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------- Coin Packages CRUD --------------------

type PkgRow = {
  id: string;
  coins: number;
  bonus_coins: number;
  price_pkr: number;
  label: string | null;
  badge: string | null;
  sort_order: number;
  active: boolean;
};

function CoinPackagesEditor() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_packages")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PkgRow[];
    },
  });

  const [draft, setDraft] = useState({
    coins: 1000,
    bonus_coins: 0,
    price_pkr: 200,
    label: "",
    badge: "",
    sort_order: 99,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coin_packages").insert({
        coins: draft.coins,
        bonus_coins: draft.bonus_coins,
        price_pkr: draft.price_pkr,
        label: draft.label || null,
        badge: draft.badge || null,
        sort_order: draft.sort_order,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package added");
      qc.invalidateQueries({ queryKey: ["admin_packages"] });
      qc.invalidateQueries({ queryKey: ["coin_packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (p: PkgRow) => {
      const { error } = await supabase
        .from("coin_packages")
        .update({ active: !p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_packages"] });
      qc.invalidateQueries({ queryKey: ["coin_packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coin_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin_packages"] });
      qc.invalidateQueries({ queryKey: ["coin_packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 font-bold">Coin Packages</h3>
      <div className="space-y-2">
        {list.data?.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {p.coins.toLocaleString()}
                {p.bonus_coins > 0 && (
                  <span className="text-[color:var(--gold)]"> +{p.bonus_coins}</span>
                )}{" "}
                · Rs {Number(p.price_pkr).toLocaleString()}
              </p>
              <p className="text-muted-foreground">
                {p.label || "—"} {p.badge && `· ${p.badge}`}
              </p>
            </div>
            <button
              onClick={() => toggle.mutate(p)}
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                p.active
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {p.active ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this package?")) remove.mutate(p.id);
              }}
              className="rounded-full bg-red-500/10 p-1.5 text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-border p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Add new package
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["coins", "Coins", "number"],
              ["bonus_coins", "Bonus", "number"],
              ["price_pkr", "Price (PKR)", "number"],
              ["sort_order", "Order", "number"],
              ["label", "Label", "text"],
              ["badge", "Badge", "text"],
            ] as const
          ).map(([k, l, t]) => (
            <input
              key={k}
              type={t}
              placeholder={l}
              value={String(draft[k] ?? "")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [k]: t === "number" ? Number(e.target.value) : e.target.value,
                }))
              }
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
          ))}
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add package
        </button>
      </div>
    </div>
  );
}
