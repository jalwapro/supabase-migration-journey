import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/layout/BottomNav";
import { toast } from "sonner";
import { ArrowLeft, Check, Coins, Heart, Loader2, Lock, Sparkles, X } from "lucide-react";
import {
  equipFrame,
  isAvailableNow,
  purchaseFrame,
  useFavorites,
  useFrames,
  useOwnedFrames,
  useToggleFavorite,
  type PremiumFrame,
} from "@/lib/premium-assets";

export const Route = createFileRoute("/_authenticated/shop-frames")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Premium Profile Frames — Jalwa" },
      {
        name: "description",
        content: "Buy and equip premium animated profile frames — VIP, Royal, Diamond and limited event collections.",
      },
      { property: "og:title", content: "Premium Profile Frames — Jalwa" },
      { property: "og:description", content: "Unlock VIP, Royal and Diamond profile frames for your Jalwa avatar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RARITY: Record<string, { label: string; cls: string }> = {
  classic: { label: "Classic", cls: "from-zinc-400 to-zinc-600" },
  rare: { label: "Rare", cls: "from-[#38bdf8] to-[#0ea5e9]" },
  epic: { label: "Epic", cls: "from-[#a855f7] to-[#6366f1]" },
  legendary: { label: "Legendary", cls: "from-[#ffd166] to-[#ff8a00]" },
  mythic: { label: "Mythic", cls: "from-[#ff2ea8] to-[#7b5cff]" },
  premium: { label: "Premium", cls: "from-[#ff2ea8] to-[#ffd166]" },
};

function FrameArt({ frame, avatar }: { frame: PremiumFrame; avatar?: string | null }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[140px]">
      <div className="absolute inset-[19%] overflow-hidden rounded-full bg-muted">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      {frame.image_url ? (
        <img
          src={frame.image_url}
          alt={frame.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: frame.from_color, boxShadow: `0 0 20px rgba(${frame.glow},0.75)` }}
        />
      )}
    </div>
  );
}

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const frames = useFrames();
  const owned = useOwnedFrames(user?.id);
  const favs = useFavorites("frame", user?.id);
  const toggleFav = useToggleFavorite("frame", user?.id);
  const [tab, setTab] = useState<"All" | "Owned" | "Favorites">("All");
  const [category, setCategory] = useState("All");
  const [preview, setPreview] = useState<PremiumFrame | null>(null);
  const [busy, setBusy] = useState(false);

  const p = profile as unknown as
    | { coins?: number; avatar_url?: string | null; vip_level?: number; level?: number; frame?: string | null }
    | null;
  const ownedIds = useMemo(() => new Set((owned.data ?? []).map((o) => o.frame_id)), [owned.data]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const f of frames.data ?? []) if (f.category) s.add(f.category);
    return ["All", ...[...s].sort()];
  }, [frames.data]);

  const list = useMemo(() => {
    let rows = (frames.data ?? []).filter(isAvailableNow);
    if (tab === "Owned") rows = rows.filter((f) => ownedIds.has(f.id));
    if (tab === "Favorites") rows = rows.filter((f) => favs.data?.has(f.id));
    if (category !== "All") rows = rows.filter((f) => f.category === category);
    return rows;
  }, [frames.data, tab, category, ownedIds, favs.data]);

  function lockReason(f: PremiumFrame) {
    if ((p?.vip_level ?? 0) < f.min_vip_level) return `VIP ${f.min_vip_level} required`;
    if ((p?.level ?? 0) < f.min_level) return `Level ${f.min_level} required`;
    return null;
  }

  async function buy(f: PremiumFrame) {
    setBusy(true);
    try {
      await purchaseFrame(f.id);
      toast.success(`${f.name} unlocked!`);
      qc.invalidateQueries({ queryKey: ["owned-frames"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  async function equip(f: PremiumFrame | null) {
    setBusy(true);
    try {
      await equipFrame(f ? f.id : null);
      toast.success(f ? `${f.name} equipped` : "Frame removed");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["premium-frames"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not equip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/me" aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-black">Profile Frames</h1>
          <p className="text-[11px] text-muted-foreground">Premium avatar frames · {list.length} available</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-[color:var(--gold)]/15 px-2.5 py-1 text-xs font-bold text-[color:var(--gold)]">
          <Coins className="h-3.5 w-3.5" />
          {(p?.coins ?? 0).toLocaleString()}
        </span>
      </header>

      <div className="flex gap-1.5 px-4 pt-3">
        {(["All", "Owned", "Favorites"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
              category === c ? "bg-secondary text-secondary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {frames.isLoading ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {list.map((f) => {
            const isOwned = ownedIds.has(f.id);
            const equipped = p?.frame === f.id;
            const locked = lockReason(f);
            const rar = RARITY[f.rarity] ?? RARITY.premium;
            const fav = favs.data?.has(f.id) ?? false;
            return (
              <button
                key={f.id}
                onClick={() => setPreview(f)}
                className="relative rounded-2xl border border-border bg-card p-3 text-left"
              >
                <span
                  className={`absolute left-2 top-2 rounded-full bg-gradient-to-r ${rar.cls} px-2 py-0.5 text-[9px] font-black uppercase text-black/80`}
                >
                  {rar.label}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Favourite"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFav.mutate({ assetId: f.id, on: !fav });
                  }}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/70"
                >
                  <Heart className={`h-3.5 w-3.5 ${fav ? "fill-[color:var(--primary)] text-[color:var(--primary)]" : "text-muted-foreground"}`} />
                </span>
                <div className="pt-4">
                  <FrameArt frame={f} avatar={p?.avatar_url} />
                </div>
                <p className="mt-2 truncate text-sm font-bold">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{f.category} · {f.duration_days}d</p>
                <div className="mt-1.5 flex items-center justify-between">
                  {equipped ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <Check className="h-3 w-3" /> Equipped
                    </span>
                  ) : isOwned ? (
                    <span className="text-[11px] font-bold text-sky-400">Owned</span>
                  ) : locked ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <Lock className="h-3 w-3" /> {locked}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[color:var(--gold)]">
                      <Coins className="h-3 w-3" /> {f.price.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-xs rounded-3xl border border-border bg-card p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setPreview(null)} aria-label="Close" className="mb-1 ml-auto block">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <FrameArt frame={preview} avatar={p?.avatar_url} />
            <h2 className="mt-3 text-lg font-black">{preview.name}</h2>
            {preview.description && (
              <p className="mt-1 text-xs text-muted-foreground">{preview.description}</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {preview.category} · {preview.duration_days} days · {preview.purchase_count} owners
            </p>
            {preview.is_limited && preview.ends_at && (
              <p className="mt-1 text-[11px] font-bold text-[color:var(--primary)]">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Limited until {new Date(preview.ends_at).toLocaleDateString()}
              </p>
            )}

            {(() => {
              const isOwned = ownedIds.has(preview.id);
              const equipped = p?.frame === preview.id;
              const locked = lockReason(preview);
              if (equipped) {
                return (
                  <button
                    disabled={busy}
                    onClick={() => equip(null)}
                    className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-bold"
                  >
                    Remove frame
                  </button>
                );
              }
              if (isOwned) {
                return (
                  <button
                    disabled={busy}
                    onClick={() => equip(preview)}
                    className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Equip
                  </button>
                );
              }
              if (locked) {
                return (
                  <p className="mt-4 rounded-xl bg-amber-500/15 py-2.5 text-sm font-bold text-amber-400">{locked}</p>
                );
              }
              return (
                <button
                  disabled={busy}
                  onClick={() => buy(preview)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                  Buy for {preview.price.toLocaleString()}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
