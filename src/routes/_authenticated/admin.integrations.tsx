import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  component: Integrations,
});

const GROUPS: { key: string; title: string; hint: string; fields: { name: string; label: string; type?: string }[] }[] = [
  {
    key: "branding",
    title: "Branding",
    hint: "Shown in headers and share previews.",
    fields: [
      { name: "appName", label: "App name" },
      { name: "tagline", label: "Tagline" },
    ],
  },
  {
    key: "economy",
    title: "Economy",
    hint: "Conversion rates and host share (0.6 = 60%).",
    fields: [
      { name: "pkrPerCoin", label: "PKR per 1 coin", type: "number" },
      { name: "pkrPerDiamond", label: "PKR per 1 diamond", type: "number" },
      { name: "hostGiftShare", label: "Host gift share (0-1)", type: "number" },
    ],
  },
];

type Setting = { key: string; value: Record<string, string | number> };

function Integrations() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["app_kv", "integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_kv")
        .select("key,value")
        .in("key", GROUPS.map((g) => g.key));
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
  });

  const getVal = (key: string) => list.data?.find((s) => s.key === key)?.value ?? {};

  return (
    <>
      <AdminPageHeader title="Integrations" subtitle="Third-party keys, branding, economy" />
      <ZegoCard />
      <ZegoPoolCard />


      {list.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <Card key={g.key} group={g} initial={getVal(g.key) as Record<string, string | number>} onSaved={() => qc.invalidateQueries({ queryKey: ["app_kv"] })} />
          ))}
        </div>
      )}
    </>
  );
}

function Card({
  group,
  initial,
  onSaved,
}: {
  group: (typeof GROUPS)[number];
  initial: Record<string, string | number>;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.fields.map((f) => [f.name, String(initial?.[f.name] ?? "")])),
  );

  const save = useMutation({
    mutationFn: async () => {
      const parsed: Record<string, string | number> = {};
      for (const f of group.fields) {
        const v = values[f.name] ?? "";
        parsed[f.name] = f.type === "number" ? Number(v) || 0 : v;
      }
      const { error } = await supabase.from("app_kv").upsert({ key: group.key, value: parsed });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${group.title} saved`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="font-bold">{group.title}</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{group.hint}</p>
      <div className="mt-3 space-y-2.5">
        {group.fields.map((f) => (
          <div key={f.name}>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
            <input
              type={f.type ?? "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
      </button>
    </div>
  );
}

type RtcConfig = {
  app_id: number | null;
  secret_set: boolean;
  secret_hint: string;
  server_url: string;
  updated_at: string;
};

type RtcStatus = {
  source: "pool" | "database" | "environment" | "none";
  activeAppId: number | null;
  env: { appId: number | null; secretSet: boolean; secretHint: string; serverUrl: string };
};

async function callRtcStatus(method: "GET" | "POST") {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/rtc-status", {
    method,
    headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}

function ZegoCard() {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["rtc_config"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_rtc_config");
      if (error) throw error;
      return ((data as RtcConfig[] | null)?.[0] ?? null) as RtcConfig | null;
    },
  });

  const status = useQuery({
    queryKey: ["rtc_status"],
    queryFn: async () => (await callRtcStatus("GET")) as RtcStatus,
  });

  const importEnv = useMutation({
    mutationFn: async () => callRtcStatus("POST"),
    onSuccess: (r: { slot?: number; alreadyPresent?: boolean }) => {
      toast.success(
        r?.alreadyPresent
          ? `Already in pool (slot ${r.slot})`
          : `Imported into pool slot ${r?.slot}`,
      );
      qc.invalidateQueries({ queryKey: ["rtc_pool"] });
      qc.invalidateQueries({ queryKey: ["rtc_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (!loaded && cfg.data !== undefined) {
    setLoaded(true);
    setAppId(cfg.data?.app_id ? String(cfg.data.app_id) : "");
    setServerUrl(cfg.data?.server_url ?? "");
  }


  const save = useMutation({
    mutationFn: async () => {
      const id = Number(appId);
      if (!Number.isFinite(id) || id <= 0) throw new Error("AppID must be a positive number");
      const { error } = await supabase.rpc("admin_set_rtc_config", {
        _app_id: id,
        _server_secret: secret.trim() || null,
        _server_url: serverUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ZEGOCLOUD credentials saved");
      setSecret("");
      qc.invalidateQueries({ queryKey: ["rtc_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <h3 className="font-bold">ZEGOCLOUD — Voice &amp; Video RTC</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Enter your ZEGOCLOUD AppID and ServerSecret manually. Saved values override the
        server environment secrets and take effect within ~30 seconds — no redeploy needed.
      </p>

      {/* Live status — which credential the server is really using right now */}
      {status.data && (
        <div className="mt-3 rounded-xl border border-border bg-input/40 p-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">Active source</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">
              {status.data.source === "pool"
                ? "ID Pool"
                : status.data.source === "database"
                ? "Admin panel"
                : status.data.source === "environment"
                ? "Server environment"
                : "Not configured"}
            </span>
            {status.data.activeAppId ? <span>AppID: <b>{status.data.activeAppId}</b></span> : null}
          </div>
          {status.data.env.appId ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Environment credential found — AppID <b className="text-foreground">{status.data.env.appId}</b>
                {status.data.env.secretSet ? ` · secret ${status.data.env.secretHint}` : " · secret missing"}
              </span>
              <button
                onClick={() => importEnv.mutate()}
                disabled={importEnv.isPending}
                className="rounded-full border border-border px-3 py-1 font-semibold disabled:opacity-60"
              >
                {importEnv.isPending ? "Importing…" : "Import into ID Pool"}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">No ZEGO credentials in server environment.</div>
          )}
        </div>
      )}

      {cfg.isLoading ? (
        <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AppID</label>
            <input
              inputMode="numeric"
              value={appId}
              onChange={(e) => setAppId(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="1234567890"
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ServerSecret {cfg.data?.secret_set ? `(saved: ${cfg.data.secret_hint})` : "(not set)"}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={cfg.data?.secret_set ? "Leave blank to keep current" : "32-character secret"}
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Server URL (optional)</label>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://webliveroom...zego.im/ws"
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="md:col-span-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save RTC credentials
          </button>
        </div>
      )}
    </div>
  );
}

type PoolRow = {
  id: string;
  slot: number;
  label: string;
  app_id: number;
  secret_hint: string;
  server_url: string;
  minutes_limit: number;
  minutes_used: number;
  exhausted: boolean;
  enabled: boolean;
  last_used_at: string | null;
  environment: string;
  verified_at: string | null;
  verify_status: string;
  verify_error: string | null;
  updated_at: string;
};

type HistoryRow = {
  id: string;
  slot: number;
  action: string;
  label: string;
  app_id: number | null;
  secret_hint: string;
  server_url: string;
  environment: string;
  enabled: boolean;
  changed_by_name: string | null;
  created_at: string;
};

type VerifyResult = {
  ok: boolean;
  status: "verified" | "token_only" | "invalid";
  message: string;
  appId: number;
};

async function verifyCredentials(input: { slot?: number; appId?: number; secret?: string }) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/rtc-verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok && !body?.status) throw new Error(body?.error ?? "Verification failed");
  return body as VerifyResult;
}

const ENVIRONMENTS = ["production", "staging", "development"] as const;

const EMPTY_DRAFT = {
  slot: "",
  label: "",
  appId: "",
  secret: "",
  serverUrl: "",
  limit: "10000",
  environment: "production",
};

function ZegoPoolCard() {
  const qc = useQueryClient();
  const pool = useQuery({
    queryKey: ["rtc_pool"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_rtc_pool");
      if (error) throw error;
      return (data ?? []) as PoolRow[];
    },
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ["rtc_history"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_rtc_history", { _limit: 25 });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [showHistory, setShowHistory] = useState(false);

  const rows = pool.data ?? [];
  const activeSlot = rows.find((r) => r.enabled && !r.exhausted)?.slot ?? null;
  const nextFreeSlot = (() => {
    for (let i = 1; i <= 50; i++) if (!rows.some((r) => r.slot === i)) return i;
    return 1;
  })();


  // Save = verify first, then persist. Invalid credentials are rejected so a
  // live configuration is never replaced by a broken one.
  const save = useMutation({
    mutationFn: async (d: typeof EMPTY_DRAFT) => {
      const slot = Number(d.slot || nextFreeSlot);
      const appId = Number(d.appId);
      if (!Number.isFinite(appId) || appId <= 0) throw new Error("AppID must be a positive number");
      const secret = d.secret.trim();
      const existing = rows.find((r) => r.slot === slot);
      if (!secret && !existing) throw new Error("ServerSecret required");
      if (secret && secret.length !== 32) throw new Error("ServerSecret must be exactly 32 characters");

      const check = await verifyCredentials({
        slot: existing ? slot : undefined,
        appId,
        ...(secret ? { secret } : {}),
      });
      if (!check.ok) throw new Error(check.message);

      const { error } = await supabase.rpc("admin_upsert_rtc_slot", {
        _slot: slot,
        _app_id: appId,
        _server_secret: secret || null,
        _server_url: d.serverUrl.trim(),
        _label: d.label.trim(),
        _minutes_limit: Number(d.limit) || 10000,
        _enabled: true,
        _environment: d.environment,
      });
      if (error) throw error;
      // stamp the freshly-saved slot with its verification result
      await verifyCredentials({ slot });
      return check;
    },
    onSuccess: (check) => {
      toast.success(check.message);
      setDraft({ ...EMPTY_DRAFT });
      qc.invalidateQueries({ queryKey: ["rtc_pool"] });
      qc.invalidateQueries({ queryKey: ["rtc_history"] });
      qc.invalidateQueries({ queryKey: ["rtc_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: async (row: PoolRow) => verifyCredentials({ slot: row.slot }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["rtc_pool"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rollback = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_rollback_rtc_slot", { _history_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rolled back to previous configuration");
      qc.invalidateQueries({ queryKey: ["rtc_pool"] });
      qc.invalidateQueries({ queryKey: ["rtc_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = useMutation({
    mutationFn: async (a: { type: "delete" | "reset" | "toggle"; row: PoolRow }) => {
      if (a.type === "delete") {
        const { error } = await supabase.rpc("admin_delete_rtc_slot", { _slot: a.row.slot });
        if (error) throw error;
      } else if (a.type === "reset") {
        const { error } = await supabase.rpc("admin_reset_rtc_slot", { _slot: a.row.slot });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("admin_upsert_rtc_slot", {
          _slot: a.row.slot,
          _app_id: a.row.app_id,
          _server_secret: null,
          _server_url: a.row.server_url,
          _label: a.row.label,
          _minutes_limit: a.row.minutes_limit,
          _enabled: !a.row.enabled,
          _environment: a.row.environment ?? "production",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rtc_pool"] });
      qc.invalidateQueries({ queryKey: ["rtc_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const inputCls =
    "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">ZEGOCLOUD ID Pool — auto rotation</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Add up to 50 ZEGO IDs (e.g. 10). Jab ek ID ke minutes khatam ho jayen, app
            khud-ba-khud agli ID par shift ho jata hai. Sab IDs khatam hone par cycle
            reset ho kar dobara slot 1 se shuru hota hai.
          </p>
        </div>
        <button
          onClick={() => supabase.rpc("admin_reset_rtc_slot", { _slot: null }).then(() => { toast.success("All usage reset"); qc.invalidateQueries({ queryKey: ["rtc_pool"] }); })}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold"
        >
          Reset all usage
        </button>
      </div>

      {/* Add / update a slot */}
      <div className="mt-3 grid gap-2 md:grid-cols-6">
        <input className={inputCls} placeholder={`Slot #${nextFreeSlot}`} inputMode="numeric"
          value={draft.slot} onChange={(e) => setDraft({ ...draft, slot: e.target.value.replace(/\D/g, "") })} />
        <input className={inputCls} placeholder="Label (optional)"
          value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className={inputCls} placeholder="AppID" inputMode="numeric"
          value={draft.appId} onChange={(e) => setDraft({ ...draft, appId: e.target.value.replace(/\D/g, "") })} />
        <input className={inputCls} type="password" autoComplete="new-password" placeholder="ServerSecret"
          value={draft.secret} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} />
        <input className={inputCls} placeholder="Minutes limit" inputMode="numeric"
          value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value.replace(/\D/g, "") })} />
        <button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Add / Update
        </button>
        <input className={`${inputCls} md:col-span-6`} placeholder="Server URL (optional, wss://...)"
          value={draft.serverUrl} onChange={(e) => setDraft({ ...draft, serverUrl: e.target.value })} />
      </div>

      {/* Existing slots */}
      <div className="mt-4 space-y-2">
        {pool.isLoading ? (
          <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No ZEGO IDs added yet.</p>
        ) : (
          rows.map((r) => {
            const pct = Math.min(100, Math.round((Number(r.minutes_used) / Math.max(Number(r.minutes_limit), 1)) * 100));
            return (
              <div key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">#{r.slot}</span>
                  <span className="text-sm font-semibold">{r.label || `AppID ${r.app_id}`}</span>
                  <span className="text-[11px] text-muted-foreground">{r.app_id} · {r.secret_hint}</span>
                  {activeSlot === r.slot && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">ACTIVE</span>
                  )}
                  {r.exhausted && (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">EXHAUSTED</span>
                  )}
                  {!r.enabled && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">DISABLED</span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => act.mutate({ type: "toggle", row: r })} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold">
                      {r.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => act.mutate({ type: "reset", row: r })} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold">
                      Reset
                    </button>
                    <button onClick={() => act.mutate({ type: "delete", row: r })} className="rounded-full border border-destructive/40 px-2.5 py-1 text-[10px] font-semibold text-destructive">
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${r.exhausted ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {Math.round(Number(r.minutes_used))} / {Math.round(Number(r.minutes_limit))} minutes used ({pct}%)
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
