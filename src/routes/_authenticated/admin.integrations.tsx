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
