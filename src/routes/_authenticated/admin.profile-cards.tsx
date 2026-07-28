import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, AdminPageHeader } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Save, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { PROFILE_CARD_CATEGORIES, type ProfileCard } from "@/lib/profileCards/registry";
import { PremiumProfileCard } from "@/components/profile/PremiumProfileCard";

export const Route = createFileRoute("/_authenticated/admin/profile-cards")({ component: Page });

const empty: Partial<ProfileCard> = {
  key: "",
  name: "",
  description: "",
  category: "Basic",
  rarity: "common",
  bg_media_url: "builtin:classic",
  bg_media_type: "builtin",
  bg_chromakey: "none",
  thumbnail_url: "",
  frame_effect: "gold",
  accent_color: "#ffd76a",
  glow_color: "#a855f7",
  particle_style: "sparkles",
  price_coins: 1000,
  price_diamonds: 0,
  min_vip_level: 0,
  duration_days: null,
  is_active: true,
  is_limited: false,
  sort_order: 0,
};

function Page() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ProfileCard> | null>(null);
  const [filter, setFilter] = useState("All");

  const list = useQuery({
    queryKey: ["admin-profile-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_cards")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileCard[];
    },
  });

  const cats = useMemo(() => ["All", ...PROFILE_CARD_CATEGORIES], []);
  const rows = useMemo(() => {
    const all = list.data ?? [];
    return filter === "All" ? all : all.filter((e) => e.category === filter);
  }, [list.data, filter]);

  const purchaseStats = useQuery({
    queryKey: ["admin-profile-card-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_card_purchases")
        .select("card_id");
      if (error) throw error;
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => m.set(r.card_id, (m.get(r.card_id) ?? 0) + 1));
      return m;
    },
  });

  async function save() {
    if (!editing) return;
    const payload: any = { ...editing };
    // strip empty string dates so RPC treats as null
    for (const k of ["starts_at", "ends_at"]) if (!payload[k]) delete payload[k];
    const { error } = await supabase.rpc("admin_upsert_profile_card", { _payload: payload });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-profile-cards"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this profile card? Owners keep it in inventory but it disappears from the shop.")) return;
    const { error } = await supabase.rpc("admin_delete_profile_card", { _id: id });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-profile-cards"] });
  }

  async function uploadTo(field: "bg_media_url" | "thumbnail_url", file: File) {
    if (!editing) return;
    const path = `profile-cards/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("shop-assets").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
    setEditing({ ...editing, [field]: data.publicUrl });
    if (field === "bg_media_url") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const type = ext === "mp4" ? "mp4" : ext === "webm" ? "webm" : "image";
      setEditing((e) => ({ ...(e ?? {}), [field]: data.publicUrl, bg_media_type: type }));
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        title="Profile Cards"
        subtitle="Manage the premium profile card catalog. Owners equip one card to skin their profile."
        right={
          <button
            onClick={() => setEditing({ ...empty })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New card
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              filter === c
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-muted/50 text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-[3/4] w-full">
                <PremiumProfileCard card={c} rounded="rounded-none" className="h-full w-full" />
                {!c.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs font-bold text-white">
                    Inactive
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.category} · {c.rarity}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(c)} className="rounded-lg bg-muted p-1.5 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(c.id)} className="rounded-lg bg-destructive/10 p-1.5 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  {c.price_coins > 0 && <span className="rounded-full bg-[color:var(--gold)]/15 px-1.5 py-0.5 text-[color:var(--gold)]">🪙 {c.price_coins.toLocaleString()}</span>}
                  {c.price_diamonds > 0 && <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">💎 {c.price_diamonds.toLocaleString()}</span>}
                  {c.min_vip_level > 0 && <span className="rounded-full bg-muted/50 px-1.5 py-0.5">VIP {c.min_vip_level}</span>}
                  <span className="rounded-full bg-muted/40 px-1.5 py-0.5">Sold: {purchaseStats.data?.get(c.id) ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          onUpload={uploadTo}
        />
      )}
    </AdminShell>
  );
}

function EditModal({
  value,
  onChange,
  onCancel,
  onSave,
  onUpload,
}: {
  value: Partial<ProfileCard>;
  onChange: (v: Partial<ProfileCard>) => void;
  onCancel: () => void;
  onSave: () => void;
  onUpload: (field: "bg_media_url" | "thumbnail_url", file: File) => void;
}) {
  const set = <K extends keyof ProfileCard>(k: K, v: ProfileCard[K] | any) => onChange({ ...value, [k]: v });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{value.id ? "Edit" : "New"} profile card</h2>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-lg bg-muted px-3 py-1.5 text-sm"><X className="h-4 w-4" /></button>
            <button onClick={onSave} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Key (unique)">
              <input value={value.key ?? ""} onChange={(e) => set("key", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Name">
              <input value={value.name ?? ""} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Description">
              <textarea value={value.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={value.category ?? "Basic"} onChange={(e) => set("category", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {PROFILE_CARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Rarity">
                <select value={value.rarity ?? "common"} onChange={(e) => set("rarity", e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["common","rare","epic","legendary","mythic"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Background media URL (e.g. builtin:king or CDN URL)">
              <div className="flex gap-2">
                <input value={value.bg_media_url ?? ""} onChange={(e) => set("bg_media_url", e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
                  <Upload className="h-3 w-3" />
                  <input type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => e.target.files && onUpload("bg_media_url", e.target.files[0])} />
                  Upload
                </label>
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Media type">
                <select value={value.bg_media_type ?? "builtin"} onChange={(e) => set("bg_media_type", e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["builtin","image","mp4","webm","lottie","svga"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Chromakey">
                <select value={value.bg_chromakey ?? "none"} onChange={(e) => set("bg_chromakey", e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["none","green","black","luma"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Frame effect">
                <select value={value.frame_effect ?? "gold"} onChange={(e) => set("frame_effect", e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["gold","neon","diamond","aurora","none"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Accent">
                <input type="color" value={value.accent_color ?? "#ffd76a"} onChange={(e) => set("accent_color", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background" />
              </Field>
              <Field label="Glow">
                <input type="color" value={value.glow_color ?? "#a855f7"} onChange={(e) => set("glow_color", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background" />
              </Field>
              <Field label="Particle">
                <select value={value.particle_style ?? "sparkles"} onChange={(e) => set("particle_style", e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["none","sparkles","embers","petals","snow","stars","bubbles"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Coins"><NumberInput value={value.price_coins ?? 0} onChange={(v) => set("price_coins", v)} /></Field>
              <Field label="Diamonds"><NumberInput value={value.price_diamonds ?? 0} onChange={(v) => set("price_diamonds", v)} /></Field>
              <Field label="Min VIP"><NumberInput value={value.min_vip_level ?? 0} onChange={(v) => set("min_vip_level", v)} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (days, blank = permanent)">
                <input
                  type="number"
                  value={value.duration_days ?? ""}
                  onChange={(e) => set("duration_days", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Sort order"><NumberInput value={value.sort_order ?? 0} onChange={(v) => set("sort_order", v)} /></Field>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Toggle label="Active" value={!!value.is_active} onChange={(v) => set("is_active", v)} />
              <Toggle label="Limited-time" value={!!value.is_limited} onChange={(v) => set("is_limited", v)} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground">Preview</div>
            <div className="mt-2 mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-2xl">
              <PremiumProfileCard
                card={{
                  bg_media_url: value.bg_media_url ?? "builtin:classic",
                  bg_media_type: (value.bg_media_type ?? "builtin") as any,
                  bg_chromakey: (value.bg_chromakey ?? "none") as any,
                  frame_effect: (value.frame_effect ?? "gold") as any,
                  accent_color: value.accent_color ?? "#ffd76a",
                  glow_color: value.glow_color ?? "#a855f7",
                }}
                rounded="rounded-2xl"
                className="h-full w-full"
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tip: use <code>builtin:&lt;key&gt;</code> to reuse the 45 built-in animated backgrounds. Otherwise upload
              MP4/WebM (with optional green chromakey) or an image.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
    />
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
