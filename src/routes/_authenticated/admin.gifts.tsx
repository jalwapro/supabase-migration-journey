import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gifts")({
  component: GiftsAdmin,
});

type GiftRow = {
  id: string;
  name: string;
  icon: string | null;
  price_coins: number;
  diamonds_value: number;
  category: string | null;
  sort_order: number;
  active: boolean;
};

function GiftsAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_gifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gifts").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as GiftRow[];
    },
  });

  const [draft, setDraft] = useState({
    name: "",
    icon: "🎁",
    price_coins: 100,
    diamonds_value: 10,
    category: "popular",
    sort_order: 99,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("gifts").insert({ ...draft, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gift added");
      setDraft((d) => ({ ...d, name: "" }));
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (g: GiftRow) => {
      const { error } = await supabase.from("gifts").update({ active: !g.active }).eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_gifts"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
    },
  });

  return (
    <>
      <AdminPageHeader title="Gifts Management" subtitle="Catalog shown in the gift sheet" />
      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {list.data?.map((g) => (
            <div key={g.id} className="glass flex items-center gap-2 rounded-xl p-2 text-xs">
              <span className="text-2xl leading-none">{g.icon ?? "🎁"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.name}</p>
                <p className="truncate text-[10px] text-[color:var(--gold)]">{g.price_coins.toLocaleString()} coins</p>
              </div>
              <button
                onClick={() => toggle.mutate(g)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${g.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
              >
                {g.active ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => confirm(`Delete ${g.name}?`) && remove.mutate(g.id)}
                className="rounded-full bg-red-500/10 p-1 text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="glass h-fit rounded-2xl p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new gift</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["name", "Name", "text"],
                ["icon", "Icon (emoji)", "text"],
                ["price_coins", "Price (coins)", "number"],
                ["diamonds_value", "Diamonds", "number"],
                ["category", "Category", "text"],
                ["sort_order", "Order", "number"],
              ] as const
            ).map(([k, l, t]) => (
              <input
                key={k}
                type={t}
                placeholder={l}
                value={String(draft[k] ?? "")}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: t === "number" ? Number(e.target.value) : e.target.value }))}
                className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
              />
            ))}
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-3 w-3" /> Add gift
          </button>
        </div>
      </div>
    </>
  );
}
