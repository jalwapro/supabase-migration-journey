import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Trash2, Package, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gift-batches")({
  component: GiftBatchesAdmin,
});

const CATEGORIES = ["popular", "classic", "love", "luxury", "vip", "lucky", "premium"] as const;
const CLIP_TYPES = ["none", "svg", "mp4", "webm"] as const;

type BatchItem = {
  name: string;
  emoji?: string;
  price: number;
  category: (typeof CATEGORIES)[number] | string;
  clip_path?: string;
  clip_type?: (typeof CLIP_TYPES)[number];
  image_url?: string;
  sort_order?: number;
  is_active?: boolean;
  animation?: string;
  is_milestone?: boolean;
  chromakey?: string;
};

const SAMPLE: BatchItem[] = [
  { name: "Sample Rose", emoji: "🌹", price: 100, category: "love", clip_type: "none", is_active: true },
  { name: "Sample Crown", emoji: "👑", price: 5000, category: "vip", clip_type: "none", is_active: true },
];

function validateItem(x: unknown, idx: number): BatchItem {
  if (!x || typeof x !== "object") throw new Error(`Item ${idx}: must be object`);
  const o = x as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name) throw new Error(`Item ${idx}: name required`);
  const price = Number(o.price ?? 0);
  if (!Number.isFinite(price) || price < 0) throw new Error(`Item ${idx} (${name}): invalid price`);
  const category = String(o.category ?? "popular");
  const clip_type = (o.clip_type ?? "none") as BatchItem["clip_type"];
  if (clip_type && !CLIP_TYPES.includes(clip_type)) throw new Error(`Item ${idx} (${name}): bad clip_type`);
  return {
    name,
    emoji: (o.emoji as string) || "🎁",
    price,
    category,
    clip_type,
    clip_path: (o.clip_path as string) || undefined,
    image_url: (o.image_url as string) || undefined,
    sort_order: Number.isFinite(Number(o.sort_order)) ? Number(o.sort_order) : 99,
    is_active: o.is_active === undefined ? true : Boolean(o.is_active),
    animation: (o.animation as string) || "pop",
    is_milestone: Boolean(o.is_milestone),
    chromakey: (o.chromakey as string) || "auto",
  };
}

function GiftBatchesAdmin() {
  const qc = useQueryClient();
  const [batchName, setBatchName] = useState("");
  const [json, setJson] = useState(JSON.stringify(SAMPLE, null, 2));

  const parsed = useMemo(() => {
    try {
      const raw = JSON.parse(json);
      if (!Array.isArray(raw)) return { error: "JSON must be an array", items: [] as BatchItem[] };
      const items = raw.map(validateItem);
      return { error: null as string | null, items };
    } catch (e) {
      return { error: (e as Error).message, items: [] as BatchItem[] };
    }
  }, [json]);

  const batches = useQuery({
    queryKey: ["admin_gift_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,batch_name,batch_created_at,is_active,price,category")
        .not("batch_name", "is", null)
        .order("batch_created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, {
        batch_name: string;
        created_at: string | null;
        count: number;
        active: number;
        total_price: number;
        ids: string[];
      }>();
      for (const g of data ?? []) {
        const key = g.batch_name as string;
        const cur = map.get(key) ?? {
          batch_name: key,
          created_at: g.batch_created_at as string | null,
          count: 0, active: 0, total_price: 0, ids: [] as string[],
        };
        cur.count += 1;
        if (g.is_active) cur.active += 1;
        cur.total_price += Number(g.price ?? 0);
        cur.ids.push(g.id as string);
        map.set(key, cur);
      }
      return Array.from(map.values());
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const name = batchName.trim();
      if (!name) throw new Error("Batch name required");
      if (parsed.error) throw new Error(parsed.error);
      if (!parsed.items.length) throw new Error("At least one item required");
      const now = new Date().toISOString();
      const rows = parsed.items.map((it) => ({
        name: it.name,
        emoji: it.emoji || "🎁",
        icon: it.emoji || "🎁",
        price: it.price,
        price_coins: it.price,
        category: it.category,
        animation: it.animation || "pop",
        sort_order: it.sort_order ?? 99,
        clip_path: it.clip_type && it.clip_type !== "none" ? it.clip_path ?? null : null,
        clip_type: it.clip_type && it.clip_type !== "none" ? it.clip_type : "mp4",
        image_url: it.image_url ?? null,
        is_active: it.is_active ?? true,
        active: it.is_active ?? true,
        is_milestone: Boolean(it.is_milestone),
        chromakey: it.chromakey || "auto",
        batch_name: name,
        batch_created_at: now,
      }));
      const { error } = await supabase.from("gifts").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Batch created — ${n} gifts added`);
      setBatchName("");
      qc.invalidateQueries({ queryKey: ["admin_gift_batches"] });
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBatch = useMutation({
    mutationFn: async ({ batch_name, activate }: { batch_name: string; activate: boolean }) => {
      const { error } = await supabase
        .from("gifts")
        .update({ is_active: activate, active: activate })
        .eq("batch_name", batch_name);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Batch ${v.activate ? "activated" : "deactivated"}`);
      qc.invalidateQueries({ queryKey: ["admin_gift_batches"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBatch = useMutation({
    mutationFn: async (batch_name: string) => {
      const { error } = await supabase.from("gifts").delete().eq("batch_name", batch_name);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batch deleted");
      qc.invalidateQueries({ queryKey: ["admin_gift_batches"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Gift Batch Control"
        subtitle="Bulk-create gifts, then activate, deactivate, or delete an entire batch at once."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Batch history */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-[color:var(--gold)]" />
            <h3 className="text-sm font-bold">Batches</h3>
            <Link
              to="/admin/gifts"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-primary"
            >
              Manage individual gifts <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {batches.isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {batches.error && (
            <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
              {(batches.error as Error).message}
            </div>
          )}

          <div className="space-y-2">
            {batches.data?.map((b) => (
              <div key={b.batch_name} className="glass rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{b.batch_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.count} gifts · {b.active} active · {b.total_price.toLocaleString()} coins total
                      {b.created_at ? ` · ${new Date(b.created_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => toggleBatch.mutate({ batch_name: b.batch_name, activate: true })}
                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400"
                  >
                    Activate all
                  </button>
                  <button
                    onClick={() => toggleBatch.mutate({ batch_name: b.batch_name, activate: false })}
                    className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400"
                  >
                    Deactivate all
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete batch "${b.batch_name}" and its ${b.count} gifts?`)) {
                        deleteBatch.mutate(b.batch_name);
                      }
                    }}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400"
                  >
                    <Trash2 className="h-3 w-3" /> Delete batch
                  </button>
                </div>
              </div>
            ))}
            {batches.data && batches.data.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">No batches yet — create one on the right.</p>
            )}
          </div>
        </div>

        {/* Create batch */}
        <div className="glass h-fit rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Create batch</p>
          </div>

          <input
            placeholder="Batch name (e.g. Luxury Batch 4)"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs outline-none"
          />

          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Items (JSON array)
          </label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className="h-72 w-full rounded-lg border border-border bg-input px-2 py-2 font-mono text-[11px] leading-snug outline-none"
          />

          <div className="mt-1 flex items-center justify-between text-[10px]">
            {parsed.error ? (
              <span className="text-red-400">{parsed.error}</span>
            ) : (
              <span className="text-emerald-400">{parsed.items.length} item(s) parsed</span>
            )}
            <button
              onClick={() => setJson(JSON.stringify(SAMPLE, null, 2))}
              className="text-muted-foreground underline"
            >
              Reset sample
            </button>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Fields: <code>name</code>, <code>price</code>, <code>category</code>, optional <code>emoji</code>,{" "}
            <code>clip_type</code> (none/svg/mp4/webm), <code>clip_path</code>, <code>image_url</code>,{" "}
            <code>sort_order</code>, <code>is_active</code>, <code>is_milestone</code>.
          </p>

          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !!parsed.error || !parsed.items.length || !batchName.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create {parsed.items.length || ""} gifts
          </button>
        </div>
      </div>
    </>
  );
}
