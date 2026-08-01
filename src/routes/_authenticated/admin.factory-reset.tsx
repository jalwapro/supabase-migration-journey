import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AlertTriangle, Loader2, ShieldAlert, Coins, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/factory-reset")({
  component: FactoryResetAdmin,
});

type Mode = "user" | "finance" | "full";

const MODES: { key: Mode; label: string; desc: string; icon: typeof Users; tone: string }[] = [
  {
    key: "user",
    label: "Reset User Data",
    desc: "Levels, XP, VIP, gifts sent/received, tasks, rankings and notifications.",
    icon: Users,
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  {
    key: "finance",
    label: "Reset Finance Data",
    desc: "Coins, diamonds, wallet ledger, recharges and withdrawal requests.",
    icon: Coins,
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    key: "full",
    label: "Factory Reset",
    desc: "Everything above plus live rooms, seats, chat and presence data.",
    icon: Trash2,
    tone: "border-red-500/40 bg-red-500/10 text-red-300",
  },
];

const STEPS = [
  "Resetting Wallet…",
  "Resetting Levels…",
  "Clearing Finance…",
  "Clearing Leaderboards…",
  "Clearing Cache…",
  "Resetting Rooms…",
  "Cleaning Database…",
  "Finalizing…",
];

function FactoryResetAdmin() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode | null>(null);
  const [password, setPassword] = useState("");
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  const prodQ = useQuery({
    queryKey: ["production_mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_kv")
        .select("value")
        .eq("key", "production_mode")
        .maybeSingle();
      if (error) throw error;
      return String(data?.value) === "true";
    },
  });

  const logsQ = useQuery({
    queryKey: ["factory_reset_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factory_reset_logs")
        .select("id,mode,success,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!mode) throw new Error("Pick a reset mode first");
      setRunning(true);
      setStep(0);
      const ticker = setInterval(
        () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
        450,
      );
      try {
        const { data, error } = await supabase.rpc("admin_factory_reset", {
          _mode: mode,
          _password: password,
          _ip: null,
        });
        if (error) throw error;
        return data;
      } finally {
        clearInterval(ticker);
      }
    },
    onSuccess: () => {
      setStep(STEPS.length - 1);
      toast.success(
        "Factory Reset Completed Successfully. All testing users and testing data have been restored to their default state.",
      );
      setPassword("");
      setMode(null);
      void qc.invalidateQueries({ queryKey: ["factory_reset_logs"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Reset failed");
      void qc.invalidateQueries({ queryKey: ["factory_reset_logs"] });
    },
    onSettled: () => setRunning(false),
  });

  if (prodQ.data) {
    return (
      <div className="p-4">
        <AdminPageHeader title="Factory Reset" subtitle="Developer Tools" />
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-bold text-red-300">Disabled in Production Mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Factory Reset is unavailable while the app runs in production. Real users and
              financial data can never be reset accidentally.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pct = running ? Math.round(((step + 1) / STEPS.length) * 100) : 0;

  return (
    <div className="p-4 pb-16">
      <AdminPageHeader
        title="Factory Reset"
        subtitle="Developer Tools — testing data only"
      />

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/90">
          Admin/moderator accounts, login credentials, official gifts &amp; R2 assets,
          integrations and all app settings are never touched.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              disabled={running}
              className={`rounded-2xl border p-4 text-left transition ${
                active ? m.tone : "border-border bg-card/40 text-foreground hover:bg-card/70"
              }`}
            >
              <Icon className="h-5 w-5" />
              <p className="mt-2 text-sm font-bold">{m.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 max-w-md rounded-2xl border border-border bg-card/40 p-4">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Reset password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter reset password"
          disabled={running}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => run.mutate()}
          disabled={!mode || !password || running}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {running ? "Resetting…" : mode ? MODES.find((m) => m.key === mode)!.label : "Select a mode"}
        </button>

        {running && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {STEPS[step]} <span className="font-bold text-foreground">{pct}%</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Recent reset attempts
        </p>
        <div className="overflow-hidden rounded-2xl border border-border">
          {(logsQ.data ?? []).length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">No attempts logged yet.</p>
          )}
          {(logsQ.data ?? []).map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs last:border-0"
            >
              <span className="font-semibold">{l.mode}</span>
              <span className={l.success ? "text-emerald-400" : "text-red-400"}>
                {l.success ? "success" : (l.reason ?? "failed")}
              </span>
              <span className="text-muted-foreground">
                {new Date(l.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
