import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CheckCircle2, ExternalLink, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsAdmin,
});

type RuntimeConfig = {
  primary_domain: string;
  alternate_domains: string[];
  native_bootstrap_domain: string;
  canonical_redirect: boolean;
  support_email: string;
};

type Settings = {
  splash_enabled: boolean;
  splash_duration: number;
  splash_image: string | null;
  splash_video: string | null;
  default_bg_opacity: number;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>{children}</div>;
}

function RuntimeStatus({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-card/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-xs font-mono">{value}</p></div>;
}

function SettingsAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });

  const runtimeQuery = useQuery({
    queryKey: ["admin_runtime_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_kv").select("value").eq("key", "runtime_config").maybeSingle();
      if (error) throw error;
      const value = (data?.value ?? {}) as Partial<RuntimeConfig>;
      return {
        primary_domain: String(value.primary_domain ?? "https://www.jalwa.pro").replace(/\/$/, ""),
        alternate_domains: Array.isArray(value.alternate_domains) ? value.alternate_domains.map(String).filter(Boolean) : [],
        native_bootstrap_domain: String(value.native_bootstrap_domain ?? value.primary_domain ?? "https://www.jalwa.pro").replace(/\\/$/, ""),
        canonical_redirect: Boolean(value.canonical_redirect ?? false),
        support_email: String(value.support_email ?? "admin@jalwa.pro"),
      } satisfies RuntimeConfig;
    },
  });

  const [runtime, setRuntime] = useState<RuntimeConfig>({
    primary_domain: "https://www.jalwa.pro",
    alternate_domains: ["https://jalwa.pro"],
    native_bootstrap_domain: "https://www.jalwa.pro",
    canonical_redirect: false,
    support_email: "admin@jalwa.pro",
  });

  useEffect(() => {
    if (runtimeQuery.data) setRuntime(runtimeQuery.data);
  }, [runtimeQuery.data]);

  const saveRuntime = useMutation({
    mutationFn: async () => {
      const normalize = (value: string) => {
        const v = value.trim();
        if (!v) return "";
        const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
        return url.origin;
      };
      const primary = normalize(runtime.primary_domain);
      const nativeBootstrap = normalize(runtime.native_bootstrap_domain || primary);
      if (!primary || !nativeBootstrap) throw new Error("Primary domain and native bootstrap domain are required");
      const alternates = Array.from(new Set(runtime.alternate_domains.map(normalize).filter(Boolean).filter((v) => v !== primary)));
      const value = {
        primary_domain: primary,
        alternate_domains: alternates,
        native_bootstrap_domain: nativeBootstrap,
        canonical_redirect: runtime.canonical_redirect,
        support_email: runtime.support_email.trim(),
      };
      const { error } = await supabase.from("app_kv").upsert({ key: "runtime_config", value });
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      setRuntime(value);
      toast.success("Domain configuration saved");
      qc.invalidateQueries({ queryKey: ["admin_runtime_config"] });
      qc.invalidateQueries({ queryKey: ["runtime_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [form, setForm] = useState<Settings>({
    splash_enabled: true,
    splash_duration: 3,
    splash_image: null,
    splash_video: null,
    default_bg_opacity: 60,
  });

  useEffect(() => {
    if (!q.data) return;
    setForm({
      splash_enabled: Boolean(q.data.splash_enabled ?? true),
      splash_duration: Number(q.data.splash_duration ?? 3),
      splash_image: (q.data.splash_image as string | null) ?? null,
      splash_video: (q.data.splash_video as string | null) ?? null,
      default_bg_opacity: Number(q.data.default_bg_opacity ?? 60),
    });
  }, [q.data]);


  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").update(form).eq("id", "global");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin_settings"] });
      qc.invalidateQueries({ queryKey: ["splash_cfg"] });
      qc.invalidateQueries({ queryKey: ["default_bg_opacity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <>
      <AdminPageHeader title="Settings" subtitle="Global platform toggles" />
      <div className="glass mb-4 max-w-4xl rounded-2xl border border-primary/20 p-4 md:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-bold">Domain & App Runtime</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Change the Jalwa web domain from one place. Runtime-generated URLs use this configuration; DNS/Vercel and third-party OAuth/payment providers still need their own domain setup.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Primary production domain">
            <input value={runtime.primary_domain} onChange={(e) => setRuntime({ ...runtime, primary_domain: e.target.value })} placeholder="https://www.jalwa.pro" className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Native bootstrap domain">
            <input value={runtime.native_bootstrap_domain} onChange={(e) => setRuntime({ ...runtime, native_bootstrap_domain: e.target.value })} placeholder="https://www.jalwa.pro" className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
            <p className="mt-1 text-[10px] text-muted-foreground">Used as the stable web origin for native builds. Changing this value does not rewrite an already-installed APK; rebuild/sync is required if you change the native bootstrap host.</p>
          </Field>
          <Field label="Alternate domains">
            <textarea value={runtime.alternate_domains.join("\n")} onChange={(e) => setRuntime({ ...runtime, alternate_domains: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} rows={3} placeholder="https://jalwa.pro\nhttps://backup.example.com" className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
            <p className="mt-1 text-[10px] text-muted-foreground">One domain per line. These are kept as app-level fallback/metadata domains.</p>
          </Field>
          <Field label="Support email">
            <input type="email" value={runtime.support_email} onChange={(e) => setRuntime({ ...runtime, support_email: e.target.value })} placeholder="admin@jalwa.pro" className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm" />
          </Field>
        </div>

        <label className="mt-3 flex items-center justify-between rounded-xl bg-card/50 px-3 py-3 text-sm">
          <span><span className="font-bold">Canonical redirect</span><span className="ml-2 text-[10px] text-muted-foreground">Keep disabled until the new domain is verified on Vercel.</span></span>
          <input type="checkbox" checked={runtime.canonical_redirect} onChange={(e) => setRuntime({ ...runtime, canonical_redirect: e.target.checked })} />
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <RuntimeStatus label="Current browser" value={typeof window !== "undefined" ? window.location.origin : "—"} />
          <RuntimeStatus label="Primary" value={runtime.primary_domain} />
          <RuntimeStatus label="Native bootstrap" value={runtime.native_bootstrap_domain} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => saveRuntime.mutate()} disabled={saveRuntime.isPending || runtimeQuery.isLoading} className="glow-4d inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
            {saveRuntime.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save domain configuration
          </button>
          <a href={runtime.primary_domain} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3" /> Open primary
          </a>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 font-bold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Central runtime configuration enabled</div>
          <p className="mt-1">Web auth redirects and server-generated app URLs use the active origin/configuration instead of requiring a code edit for every domain change. LiveKit/token/room APIs are not changed by this system.</p>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="glass max-w-2xl space-y-3 rounded-2xl p-4">
          <label className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2 text-sm">
            <span className="font-bold">Splash screen enabled</span>
            <input type="checkbox" checked={form.splash_enabled} onChange={(e) => setForm({ ...form, splash_enabled: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2 text-sm">
            <span className="font-bold">Splash duration (s)</span>
            <input type="number" min={1} max={20} value={form.splash_duration} onChange={(e) => setForm({ ...form, splash_duration: Number(e.target.value) || 3 })} className="w-16 rounded-md border border-border bg-input px-2 py-1 text-right text-xs" />
          </label>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Splash image URL</p>
            <input value={form.splash_image ?? ""} onChange={(e) => setForm({ ...form, splash_image: e.target.value || null })} className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Splash video URL</p>
            <input value={form.splash_video ?? ""} onChange={(e) => setForm({ ...form, splash_video: e.target.value || null })} className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
            <p className="mt-1 text-[10px] text-muted-foreground">Upload via Admin → Splash & Animation. Portrait 9:16, ≤ 8 MB recommended.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Default background visibility</p>
              <span className="text-xs font-bold text-primary">{form.default_bg_opacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={form.default_bg_opacity}
              onChange={(e) => setForm({ ...form, default_bg_opacity: Number(e.target.value) })}
              className="w-full accent-[color:var(--primary)]"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">0% = fully dark overlay (bg hidden), 100% = full brightness (no overlay). Applies to Jalwa default theme on home & voice rooms.</p>
          </div>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="glow-4d mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
            <Save className="h-3 w-3" /> Save settings
          </button>
        </div>
      )}
    </>
  );
}
