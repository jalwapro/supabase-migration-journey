import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATALOG_GIFTS } from "@/lib/gifts";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { getGiftAudioPrefs, playGiftAudioCue, playJalwaSignature, unlockGiftAudio } from "@/lib/giftAudio";
import { Loader2, Coins, Send, Volume2 } from "lucide-react";
import { toast } from "sonner";

export type Gift = {
  id: string; name: string; icon: string | null; icon_path?: string | null; emoji?: string | null;
  image_url: string | null; price_coins: number | null; price?: number | null; diamonds_value: number;
  category: string | null; animation: string | null; clip_path?: string | null; clip_type?: string | null; sound_url?: string | null;
};
export type GiftReceiver = { id: string; username: string | null; avatar: string | null };
type Tier = "small" | "premium" | "vip";
const TIER_ORDER: Tier[] = ["small", "premium", "vip"];
const TIER_LABEL: Record<Tier, string> = { small: "✨ Basic", premium: "💎 Premium", vip: "👑 VIP" };
function tierOf(price: number): Tier { if (price <= 300) return "small"; if (price < 2000) return "premium"; return "vip"; }
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;
function GiftTransparencyDefs() { return <svg aria-hidden="true" width="0" height="0" className="absolute h-0 w-0 overflow-hidden"><defs><filter id="jalwa-gift-luma-key" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0.2126 0.7152 0.0722 0 0"/><feComponentTransfer><feFuncA type="linear" slope="4.8" intercept="-0.42" /></feComponentTransfer></filter></defs></svg>; }
function isRoyalRoseGift(name: string | null | undefined) { const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim(); return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose")); }
function GiftPreview({ gift, large = false }: { gift: Gift; large?: boolean }) { const imgClass = "h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"; if (isRoyalRoseGift(gift.name)) return <img src={ROYAL_ROSE_THUMB_URL} alt="" className={imgClass} />; const thumb = resolveGiftImageUrl(gift.image_url ?? gift.icon_path ?? (isAssetUrlLike(gift.icon) ? gift.icon : null)); if (thumb) return <img src={thumb} alt="" className={imgClass} />; if (gift.clip_path && gift.clip_type === "svg") return <img src={resolveGiftImageUrl(gift.clip_path) ?? gift.clip_path} alt="" className={imgClass} />; return <span className={`${large ? "text-5xl" : "text-3xl"} leading-none`}>{gift.icon ?? gift.emoji ?? "🎁"}</span>; }

export function GiftSheet({ open, onClose, roomId, receivers, onSent }: { open: boolean; onClose: () => void; roomId: string; receivers: GiftReceiver[]; onSent?: (info: { gift: Gift; targets: string[] }) => void; }) {
  const { profile, refresh } = useAuth(); const qc = useQueryClient(); const [selectedGift, setSelectedGift] = useState<Gift | null>(null); const [receiverId, setReceiverId] = useState<string | null>(receivers[0]?.id ?? null); const [sendToAll, setSendToAll] = useState(false); const [qty, setQty] = useState(1); const [activeTier, setActiveTier] = useState<Tier>("small"); const [confirmOpen, setConfirmOpen] = useState(false);
  const gifts = useQuery({ queryKey: ["gifts"], queryFn: async () => { const { data, error } = await supabase.from("gifts").select("id,name,emoji,icon,icon_path,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active").order("sort_order"); if (error) throw error; const rows = (data ?? []) as (Gift & { sort_order?: number; is_active?: boolean; active?: boolean })[]; const dbGifts = rows.filter((g) => g.is_active !== false && g.active !== false); const dbIds = new Set(dbGifts.map((g) => g.id)); return [...dbGifts, ...CATALOG_GIFTS.filter((g) => !dbIds.has(g.id))]; }, enabled: open });
  const topGifter = useQuery({ queryKey: ["room_top_gifter", roomId], queryFn: async () => { const { data, error } = await supabase.rpc("room_top_gifters", { _room_id: roomId, _limit: 1 }); if (error) throw error; return (data?.[0] ?? null) as { user_id: string; username: string | null; avatar: string | null; total_coins: number } | null; }, enabled: open });
  const price = (g: Gift | null) => (g?.price_coins ?? g?.price ?? 0) as number;
  const visibleGifts = useMemo(() => (gifts.data ?? []).filter((g) => tierOf(price(g)) === activeTier).sort((a, b) => price(a) - price(b)), [gifts.data, activeTier]);
  const giftVideoUrl = (g: Gift | null) => { if (!g?.clip_path || !["mp4", "webm", "svga"].includes(g.clip_type ?? "")) return null; return resolvePlayableGiftUrl(g.clip_path); };
  const giftThumbUrl = (g: Gift | null) => !g ? null : resolveGiftImageUrl(g.image_url ?? g.icon_path ?? (isAssetUrlLike(g.icon) ? g.icon : null));
  useEffect(() => { if (!open) return; CATALOG_GIFTS.forEach((g) => preloadGiftVideo(g.clip_path)); }, [open]);
  useEffect(() => { if (!open) return; visibleGifts.forEach((g) => preloadGiftVideo(giftVideoUrl(g))); }, [open, visibleGifts]);
  useEffect(() => { if (!selectedGift) return; preloadGiftVideo(giftVideoUrl(selectedGift)); }, [selectedGift]);
  useEffect(() => { if (!open || sendToAll || (receiverId && receivers.some((r) => r.id === receiverId))) return; setReceiverId(receivers[0]?.id ?? null); }, [open, receiverId, receivers, sendToAll]);
  const send = useMutation({ mutationFn: async ({ gift, targets, quantity }: { gift: Gift; targets: string[]; quantity: number }) => { if (!targets.length) throw new Error("Pick a receiver"); if (targets.length === 1) { const { error } = await supabase.rpc("send_gift", { _room_id: roomId, _receiver_id: targets[0], _gift_id: gift.id, _quantity: quantity }); if (error) throw error; } else { const { error } = await supabase.rpc("send_gift_multi", { _room_id: roomId, _receiver_ids: targets, _gift_id: gift.id, _quantity: quantity } as any); if (error) throw error; } return { gift, quantity, coins: price(gift) * quantity }; }, onSuccess: async () => { await refresh(); qc.invalidateQueries({ queryKey: ["wallet_tx"] }); setSelectedGift(null); setQty(1); }, onError: (e: Error) => toast.error(e.message) });
  if (!open) return null;
  const totalCost = price(selectedGift) * qty * (sendToAll ? Math.max(1, receivers.length) : 1); const canAfford = (profile?.coins ?? 0) >= totalCost;
  const performSend = () => { if (!selectedGift || send.isPending) return; const targets = sendToAll ? receivers.map((r) => r.id) : receiverId ? [receiverId] : []; if (!targets.length) { toast.error("Pick a receiver"); return; } const firstReceiver = receivers.find((r) => r.id === targets[0]) ?? null; onClose(); send.mutate({ gift: selectedGift, targets, quantity: qty }); onSent?.({ gift: selectedGift, targets }); };
  const handleSend = () => { if (!selectedGift || send.isPending) return; if (!canAfford) { toast.error("Not enough coins"); return; } if (tierOf(price(selectedGift)) === "vip") { setConfirmOpen(true); return; } performSend(); };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose} data-jalwa-overlay="true" style={{ contain: "strict", isolation: "isolate" }}>
      <GiftTransparencyDefs />
      <div onClick={(e) => e.stopPropagation()} className="relative mx-auto flex h-[46dvh] max-h-[420px] min-h-[340px] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border-t-4 border-[#7c3aed] bg-[#0f041e] text-white shadow-[0_-12px_50px_rgba(124,58,237,0.35)]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)", contain: "layout paint", fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div className="mx-auto mt-2 mb-1 h-1 w-12 rounded-full bg-white/25" />
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1a0b2e] py-0.5 pl-0.5 pr-2">
            {receivers.length > 1 && <button onClick={() => setSendToAll((v) => !v)} className="grid h-6 shrink-0 place-items-center rounded-full px-2 text-[9px] font-black uppercase tracking-wider transition">{sendToAll ? "ALL" : "TO"}</button>}
            {!sendToAll && firstReceiverFallback(receivers, receiverId)}
          </div>
          <div className="flex gap-1">{TIER_ORDER.map((tier) => <button key={tier} onClick={() => setActiveTier(tier)} className="rounded-full px-2 py-1 text-[10px] font-black">{TIER_LABEL[tier]}</button>)}</div>
        </div>
      </div>
      {confirmOpen && <div />}
    </div>
  );
}

function firstReceiverFallback(receivers: GiftReceiver[], receiverId: string | null) { const r = receivers.find((x) => x.id === receiverId); return <span className="truncate text-xs">{r?.username ?? "Select receiver"}</span>; }
