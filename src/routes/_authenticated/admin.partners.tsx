import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Plus, Trash2, Handshake } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/partners")({
  component: PartnersAdmin,
});

type Partner = {
  id: string;
  user_id: string;
  percentage: number;
  note: string | null;
  is_active: boolean;
  username?: string | null;
};

function PartnersAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Partner[];
      const ids = rows.map((r) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.username]));
        rows.forEach((r) => (r.username = map.get(r.user_id) ?? null));
      }
      return rows;
    },
  });

  const [form, setForm] = useState({ username: "", percentage: 10, note: "" });

  const create = useMutation({
    mutationFn: async () => {
      const u = form.username.trim().replace(/^@/, "");
      if (!u) throw new Error("Username required");
      const { data: prof } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
      if (!prof) throw new Error("User not found");
      const { error } = await supabase.from("partners").insert({
        user_id: prof.id,
        percentage: form.percentage,
        note: form.note || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partner added");
      setForm({ username: "", percentage: 10, note: "" });
      qc.invalidateQueries({ queryKey: ["admin_partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (p: Partner) => {
      const { error } = await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_partners"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_partners"] }),
  });

  return (
    <>
      <AdminPageHeader title="Partners" subtitle="Revenue-share partners" />
      <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <input placeholder="%" type="number" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <input placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add partner
        </button>
      </div>

      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((p) => (
            <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <Handshake className="h-4 w-4 text-[color:var(--gold)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">@{p.username ?? p.user_id.slice(0, 8)}</p>
                {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
              </div>
              <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--gold)]">{p.percentage}%</span>
              <button onClick={() => toggle.mutate(p)} className={`rounded-full px-2 py-1 text-[10px] font-bold ${p.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {p.is_active ? "ON" : "OFF"}
              </button>
              <button onClick={() => confirm("Remove partner?") && remove.mutate(p.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
