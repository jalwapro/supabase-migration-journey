import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Database, Shield, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/connection")({
  component: ConnectionStatus,
});

type CheckResult = { ok: boolean; detail: string; ms: number };

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; detail: string; ms: number; data?: T }> {
  const start = performance.now();
  try {
    const data = await fn();
    return { ok: true, detail: "OK", ms: Math.round(performance.now() - start), data };
  } catch (e) {
    return { ok: false, detail: (e as Error).message || "Failed", ms: Math.round(performance.now() - start) };
  }
}

function ConnectionStatus() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

  const q = useQuery({
    queryKey: ["admin", "supabase-connection-status"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const rest: CheckResult = await timed(async () => {
        const { error } = await supabase.from("app_settings").select("id").limit(1);
        if (error) throw error;
      });
      const auth: CheckResult = await timed(async () => {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
      });
      const realtime: CheckResult = await timed(
        () =>
          new Promise<void>((resolve, reject) => {
            const ch = supabase.channel(`__conn_probe_${Date.now()}`);
            const to = setTimeout(() => {
              supabase.removeChannel(ch);
              reject(new Error("Realtime subscribe timeout"));
            }, 5000);
            ch.subscribe((status) => {
              if (status === "SUBSCRIBED") {
                clearTimeout(to);
                supabase.removeChannel(ch);
                resolve();
              } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                clearTimeout(to);
                supabase.removeChannel(ch);
                reject(new Error(`Realtime: ${status}`));
              }
            });
          }),
      );
      return { rest, auth, realtime };
    },
  });

  const envOk = Boolean(url && key);
  const allOk = envOk && q.data && q.data.rest.ok && q.data.auth.ok && q.data.realtime.ok;

  return (
    <>
      <AdminPageHeader
        title="Supabase Connection"
        subtitle="Integration status & live health checks"
        right={
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recheck
          </button>
        }
      />

      <div className={`glass mb-4 rounded-2xl p-5 ${allOk ? "border border-emerald-500/40" : "border border-amber-500/40"}`}>
        <div className="flex items-center gap-3">
          {q.isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : allOk ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 text-amber-500" />
          )}
          <div>
            <p className="text-base font-bold">
              {q.isLoading ? "Checking…" : allOk ? "Supabase is connected" : "Connection issue detected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {allOk ? "All integration checks passed." : "One or more checks failed. See details below."}
            </p>
          </div>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h3 className="mb-2 text-sm font-bold">Environment</h3>
        <Row label="VITE_SUPABASE_URL" value={url ?? "(missing)"} ok={Boolean(url)} />
        <Row label="VITE_SUPABASE_PUBLISHABLE_KEY" value={key ? `${key.slice(0, 12)}…` : "(missing)"} ok={Boolean(key)} />
        <Row label="VITE_SUPABASE_PROJECT_ID" value={projectId ?? "(missing)"} ok={Boolean(projectId)} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Check icon={Database} title="Data API (REST)" result={q.data?.rest} loading={q.isLoading} />
        <Check icon={Shield} title="Auth" result={q.data?.auth} loading={q.isLoading} />
        <Check icon={Radio} title="Realtime" result={q.data?.realtime} loading={q.isLoading} />
      </div>
    </>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono ${ok ? "text-foreground" : "text-amber-500"}`}>{value}</span>
    </div>
  );
}

function Check({
  icon: Icon,
  title,
  result,
  loading,
}: {
  icon: typeof Database;
  title: string;
  result?: CheckResult;
  loading: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-bold">{title}</p>
        <span className="ml-auto">
          {loading || !result ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : result.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {loading || !result ? "Running check…" : result.detail}
      </p>
      {result && (
        <p className="mt-1 text-[10px] text-muted-foreground">Latency: {result.ms} ms</p>
      )}
    </div>
  );
}
