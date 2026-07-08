import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Plus, Save, Trash2, RotateCcw, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/agora-slots")({
  component: AgoraSlots,
});

type Kind = "voice" | "video" | "pk";
const KINDS: { key: Kind; title: string; hint: string }[] = [
  { key: "voice", title: "Voice Rooms", hint: "Audio-only rooms use in yeh pool ki IDs." },
  { key: "video", title: "Video Rooms", hint: "Camera-on rooms use in yeh pool ki IDs." },
  { key: "pk",    title: "PK Battle",   hint: "PK / battle mode ke liye alag Agora IDs." },
];

type Slot = {
  id: string;
  kind: Kind;
  slot_index: number;
  label: string | null;
  app_id: string;
  app_certificate: string;
  minutes_quota: number;
  minutes_used: number;
  is_active: boolean;
  exhausted_at: string | null;
  last_used_at: string | null;
};

function AgoraSlots() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["agora_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agora_slots")
        .select("*")
        .order("kind")
        .order("slot_index");
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agora_slots"] });

  return (
    <>
      <AdminPageHeader
        title="Agora Slots (auto-rotate)"
        subtitle="Har category me 20 slots tak add karo — minutes khatam hote hi agla slot auto active ho jata hai."
      />
      {q.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {KINDS.map((k) => (
            <KindSection
              key={k.key}
              kind={k.key}
              title={k.title}
              hint={k.hint}
              slots={(q.data ?? []).filter((s) => s.kind === k.key)}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </>
  );
}

function KindSection({
  kind, title, hint, slots, onChanged,
}: { kind: Kind; title: string; hint: string; slots: Slot[]; onChanged: () => void }) {
  const nextIndex = useMemo(() => {
    const used = new Set(slots.map((s) => s.slot_index));
    for (let i = 1; i <= 20; i++) if (!used.has(i)) return i;
    return null;
  }, [slots]);

  const active = slots.find((s) => s.is_active && s.minutes_used < s.minutes_quota);

  const add = useMutation({
    mutationFn: async () => {
      if (nextIndex == null) throw new Error("20 slots already used for this kind");
      const { error } = await supabase.from("agora_slots").insert({
        kind, slot_index: nextIndex,
        app_id: "", app_certificate: "",
        minutes_quota: 10000, minutes_used: 0, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Slot added"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-card/50 px-3 py-1 text-[11px]">
            {slots.length}/20 slots · Active now: <b className="text-primary">#{active?.slot_index ?? "—"}</b>
          </span>
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || nextIndex == null}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Add slot
          </button>
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="mt-3 rounded-xl bg-card/30 p-4 text-center text-xs text-muted-foreground">
          Koi slot nahi. "Add slot" par click karke pehli Agora ID daal do.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {slots.map((s) => (
            <SlotCard key={s.id} slot={s} isCurrent={active?.id === s.id} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function SlotCard({ slot, isCurrent, onChanged }: { slot: Slot; isCurrent: boolean; onChanged: () => void }) {
  const [appId, setAppId] = useState(slot.app_id);
  const [cert, setCert]   = useState(slot.app_certificate);
  const [label, setLabel] = useState(slot.label ?? "");
  const [quota, setQuota] = useState(String(slot.minutes_quota));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agora_slots").update({
        app_id: appId.trim(),
        app_certificate: cert.trim(),
        label: label.trim() || null,
        minutes_quota: Number(quota) || 0,
      }).eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Slot #${slot.slot_index} saved`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agora_slots")
        .update({ is_active: !slot.is_active }).eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agora_slots")
        .update({ minutes_used: 0, is_active: true, exhausted_at: null }).eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usage reset"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agora_slots").delete().eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Slot deleted"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = Math.min(100, Math.round((Number(slot.minutes_used) / Math.max(1, Number(slot.minutes_quota))) * 100));

  return (
    <div className={`rounded-2xl border p-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold">#{slot.slot_index}</span>
          {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">ACTIVE</span>}
          {!slot.is_active && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">OFF</span>}
        </div>
        <div className="flex items-center gap-1">
          <button title="Reset usage" onClick={() => reset.mutate()} className="rounded-full bg-card p-1.5 text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /></button>
          <button title={slot.is_active ? "Disable" : "Enable"} onClick={() => toggle.mutate()} className="rounded-full bg-card p-1.5 text-muted-foreground hover:text-foreground"><Power className="h-3 w-3" /></button>
          <button title="Delete" onClick={() => { if (confirm("Delete this slot?")) del.mutate(); }} className="rounded-full bg-card p-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="space-y-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional, e.g. Project-A)"
               className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
        <input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="App ID"
               className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs font-mono" />
        <input type="password" value={cert} onChange={(e) => setCert(e.target.value)} placeholder="App Certificate"
               className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs font-mono" />
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Minutes quota</label>
          <input type="number" value={quota} onChange={(e) => setQuota(e.target.value)}
                 className="w-24 rounded-lg border border-border bg-input px-2 py-1 text-xs text-right" />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{Number(slot.minutes_used).toFixed(1)} / {slot.minutes_quota} min used</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
            <div className={`h-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button onClick={() => save.mutate()} disabled={save.isPending}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </button>
      </div>
    </div>
  );
}
