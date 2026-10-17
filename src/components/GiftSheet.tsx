import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATALOG_GIFTS } from "@/lib/gifts";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { broadcastGiftPlayback } from "@/lib/giftBroadcast";
import { Coins, Send, Loader2, Heart, Lock } from "lucide-react";
import { toast } from "sonner";

export type Gift = {
  id: string;
  name: string;
  icon: string | null;
  icon_path?: string | null;
  emoji?: string | null;
  image_url: string | null;
  price_coins: number | null;
  price?: number | null;
  diamonds_value: number;
  category: string | null;
  animation: string | null;
  clip_path?: string | null;
  clip_type?: string | null;
  sound_url?: string | null;
  audio_enabled?: boolean | null;
  audio_volume?: number | null;
  render_config?: unknown;
  duration_ms?: number | null;
  loop?: boolean | null;
  is_cp?: boolean;
  intimacy_points?: number;
  required_cp_level?: number;
};

export type GiftReceiver = { id: string; username: string | null; avatar: string | null };
export function giftAudioEnabled(gift: Pick<Gift, "audio_enabled"> | null | undefined): boolean { return gift?.audio_enabled !== false; }
export function giftAudioGain(gift: Pick<Gift, "audio_volume"> | null | undefined): number { const value = Number(gift?.audio_volume ?? 1); return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1; }
export function giftSoundSrc(gift: Pick<Gift, "sound_url"> | null | undefined): string | null { return gift?.sound_url ?? null; }

type Tier = "small" | "premium" | "vip" | "cp";
const TIER_ORDER: Tier[] = ["small", "premium", "vip", "cp"];
const TIER_LABEL: Record<Tier, string> = { small: "✨ Basic", premium: "💎 Premium", vip: "👑 VIP", cp: "❤️ CP" };
function tierOf(price: number): Tier { if (price <= 300) return "small"; if (price < 2000) return "premium"; return "vip"; }
const price = (g: Gift | null): number => (g?.price_coins ?? g?.price ?? 0) as number;
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";

// CP-exclusive gifts currently have no dedicated animation files in the CP
// catalogue. Reuse verified existing romantic MP4 assets instead of pointing
// the player at the non-existent /gifts-romantic-v2 public directory.
const CP_GIFT_ANIMATION_FALLBACKS: Record<string, string> = {
  cp_rose_bouquet: "/__l5e/assets-v1/52b0368c-56af-406e-ba16-264038c96b28/07-999-roses-heart.mp4",
  cp_love_letter: "/__l5e/assets-v1/a1b29c69-f9fe-4ea6-b777-3939c7019baa/01-rooftop-kiss.mp4",
  cp_eternal_wings: "/__l5e/assets-v1/3526a763-6b70-4a02-af44-bef62262c8b0/08-pegasus-flight.mp4",
  cp_dream_castle: "/__l5e/assets-v1/20a9db23-6afe-482b-876d-be5c335167ae/05-golden-carriage.mp4",
  cp_galaxy_carriage: "/__l5e/assets-v1/283b9a4d-e6c7-4bd9-974b-ba853244aea7/04-proposal-fireworks.mp4",
};
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function isRoyalRoseGift(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return n === "royal rose" || (n.includes("royal") && n.includes("rose"));
}

function GiftPreview({ gift, large = false }: { gift: Gift; large?: boolean }) {
  const cls = "h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]";
  if (isRoyalRoseGift(gift.name)) return <img src={ROYAL_ROSE_THUMB_URL} alt={gift.name} className={cls} />;
  const thumb = resolveGiftImageUrl(gift.image_url ?? gift.icon_path ?? (isAssetUrlLike(gift.icon) ? gift.icon : null));
  if (thumb) return <img src={thumb} alt={gift.name} className={cls} />;
  if (gift.clip_path && gift.clip_type === "svg") return <img src={resolveGiftImageUrl(gift.clip_path) ?? gift.clip_path} alt={gift.name} className={cls} />;
  return <span className={`${large ? "text-3xl" : "text-2xl"} leading-none`}>{gift.icon ?? gift.emoji ?? "🎁"}</span>;
}

const GiftGrid = memo(function GiftGrid({
  gifts,
  selectedGiftId,
  userCpLevel = 1,
  onSelect,
}: {
  gifts: Gift[];
  selectedGiftId: string | null;
  userCpLevel?: number;
  onSelect: (gift: Gift) => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollLeftRef = useRef(0);

  return (
    <div ref={gridRef} onScroll={(e) => { scrollLeftRef.current = e.currentTarget.scrollLeft; }} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 no-scrollbar scroll-smooth overscroll-contain">
      <div className="grid w-full grid-cols-4 auto-rows-[112px] gap-2">
        {gifts.map((g) => {
          const isSelected = selectedGiftId === g.id;
          const isLocked = g.is_cp && (g.required_cp_level ?? 1) > userCpLevel;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g)}
              className={`relative flex min-w-0 w-full h-full flex-col items-center justify-between rounded-xl border p-1 text-center transition-all ${
                isSelected
                  ? "border-pink-500 bg-pink-500/20 shadow-[0_0_12px_rgba(236,72,153,0.35)]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
              } ${isLocked ? "opacity-70" : ""}`}
            >
              {g.is_cp && (
                <div className="absolute -top-1 -right-1 z-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-1.5 py-0.2 text-[8px] font-black text-white shadow-sm">
                  +{g.intimacy_points}
                </div>
              )}
              {isLocked && (
                <div className="absolute top-1 left-1 z-10 flex items-center gap-0.5 rounded-full bg-black/85 border border-white/10 px-1 py-0.2 text-[8px] font-bold text-zinc-300">
                  <Lock className="h-2 w-2 text-pink-400" />Lv.{g.required_cp_level}
                </div>
              )}
              <div className="relative h-16 w-full overflow-hidden rounded-lg bg-black/20 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center p-0.5">
                  <GiftPreview gift={g} large />
                </div>
              </div>
              <div className="w-full truncate text-[10px] font-medium text-white/90 px-0.5">{g.name}</div>
              <div className="flex items-center justify-center gap-0.5 text-[9px] text-yellow-300 font-bold">
                <Coins className="h-2.5 w-2.5" />
                <span>{price(g).toLocaleString()}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export function GiftSheet({
  open,
  onClose,
  roomId,
  receivers,
  allowSelfGift,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  receivers: GiftReceiver[];
  allowSelfGift: boolean;
}) {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [sendToAll, setSendToAll] = useState(false);
  const [qty, setQty] = useState(1);
  const [activeTier, setActiveTier] = useState<Tier>("small");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReceiverIds, setSelectedReceiverIds] = useState<string[]>([]);

  // 1. Fetch user's active CP relationship
  const cpQuery = useQuery({
    queryKey: ["user_cp_relation", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("cp_relations")
        .select("id,ring_level,intimacy_score,user1_id,user2_id")
        .eq("status", "active")
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .maybeSingle();
      if (error) throw new Error(`Could not load CP relationship: ${error.message}`);
      if (!data) return null;

      // cp_relations.user1_id/user2_id reference auth.users, not profiles.
      // PostgREST cannot join those foreign keys directly to profiles, so load
      // the partner profile separately instead of silently reporting "No CP partner".
      const partnerId = data.user1_id === profile.id ? data.user2_id : data.user1_id;
      const { data: partnerProfile, error: partnerError } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .eq("id", partnerId)
        .maybeSingle();
      if (partnerError) throw new Error(`Could not load CP partner profile: ${partnerError.message}`);

      const partner = partnerProfile
        ? {
            id: partnerProfile.id,
            username: partnerProfile.username ?? null,
            avatar: partnerProfile.avatar ?? null,
          }
        : null;
      return {
        relationId: data.id,
        ringLevel: Number(data.ring_level ?? 1),
        intimacyScore: Number(data.intimacy_score ?? 0),
        partner,
      };
    },
    enabled: open && !!profile?.id,
    staleTime: 60_000,
  });

  const cpPartner = cpQuery.data?.partner ?? null;
  const cpLevel = cpQuery.data?.ringLevel ?? 1;

  // 2. Check if CP partner is inside this voice room
  const isPartnerInReceivers = useMemo(() => {
    if (!cpPartner?.id) return false;
    return receivers.some((r) => r.id === cpPartner.id);
  }, [cpPartner?.id, receivers]);

  const partnerInAudienceQuery = useQuery({
    queryKey: ["partner_in_room", roomId, cpPartner?.id],
    queryFn: async () => {
      if (!roomId || !cpPartner?.id) return false;
      const { data } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", cpPartner.id)
        .maybeSingle();
      return !!data;
    },
    enabled: open && !!cpPartner?.id && !isPartnerInReceivers,
    staleTime: 15_000,
  });

  const isPartnerInRoom = isPartnerInReceivers || !!partnerInAudienceQuery.data;

  // 3. Receiver options
  const receiverOptions = useMemo(() => {
    // Self is a valid recipient only while the current user has an active seat.
    const list = receivers.filter((r) => allowSelfGift || r.id !== profile?.id);
    if (allowSelfGift && profile?.id && !list.some((r) => r.id === profile.id)) {
      list.unshift({ id: profile.id, username: profile.username ?? "You", avatar: profile.avatar ?? null });
    }
    if (cpPartner?.id && isPartnerInRoom && !list.some((r) => r.id === cpPartner.id)) {
      list.push({ id: cpPartner.id, username: cpPartner.username ?? "Partner", avatar: cpPartner.avatar ?? null });
    }
    return list;
  }, [receivers, profile?.id, profile?.username, profile?.avatar, cpPartner, isPartnerInRoom, allowSelfGift]);

  // Reset when sheet opens or closes
  useEffect(() => {
    if (!open) return;
    setSendToAll(false);
    setSelectedGift(null);
    setQty(1);
    if (activeTier === "cp" && cpPartner?.id) {
      setSelectedReceiverIds([cpPartner.id]);
    } else if (allowSelfGift && profile?.id) {
      setSelectedReceiverIds([profile.id]);
    } else {
      const firstOtherReceiver = receivers.find((receiver) => receiver.id !== profile?.id);
      setSelectedReceiverIds(firstOtherReceiver ? [firstOtherReceiver.id] : []);
    }
  }, [open, profile?.id, allowSelfGift]);

  // When switching to CP tier, auto-lock receiver to partner
  useEffect(() => {
    if (activeTier === "cp") {
      setSendToAll(false);
      setSelectedGift(null);
      if (cpPartner?.id) {
        setSelectedReceiverIds([cpPartner.id]);
      } else {
        setSelectedReceiverIds([]);
      }
    } else {
      if (selectedGift?.is_cp) setSelectedGift(null);
      if (selectedReceiverIds.length === 0) {
        const defaultReceiver = allowSelfGift
          ? profile?.id
          : receiverOptions.find((receiver) => receiver.id !== profile?.id)?.id;
        setSelectedReceiverIds(defaultReceiver ? [defaultReceiver] : []);
      }
    }
  }, [activeTier, cpPartner?.id, allowSelfGift]);

  // 4. Regular gifts query
  const gifts = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,icon,icon_path,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active,render_config,duration_ms,loop,audio_enabled,audio_volume")
        .order("sort_order");
      if (error) throw error;
      const rows = (data ?? []) as (Gift & { sort_order?: number; is_active?: boolean; active?: boolean })[];
      const dbGifts = rows.filter((g) => g.is_active !== false && g.active !== false);
      const ids = new Set(dbGifts.map((g) => g.id));
      return [...dbGifts, ...CATALOG_GIFTS.filter((g) => !ids.has(g.id))];
    },
    enabled: open,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // 5. CP exclusive gifts query
  const cpGiftsQuery = useQuery({
    queryKey: ["cp_exclusive_gifts_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cp_exclusive_gifts_config")
        .select("id,name,price,icon_url,intimacy_points,required_cp_level,animation_url,description,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error || !data || data.length === 0) {
        return [
          { id: "cp_rose_bouquet", name: "Sweet Rose Bouquet", price: 999, icon_url: "/gifts/basic-3d/rose.png", intimacy_points: 100, required_cp_level: 1, animation_url: CP_GIFT_ANIMATION_FALLBACKS.cp_rose_bouquet, description: "Gentle romantic care" },
          { id: "cp_love_letter", name: "Love Confession", price: 2520, icon_url: "/gifts/basic-3d/confession-letter.png", intimacy_points: 280, required_cp_level: 2, animation_url: CP_GIFT_ANIMATION_FALLBACKS.cp_love_letter, description: "Heartfelt confession" },
          { id: "cp_eternal_wings", name: "Eternal Wings", price: 5200, icon_url: "/gifts/basic-3d/sweet-love.png", intimacy_points: 600, required_cp_level: 3, animation_url: CP_GIFT_ANIMATION_FALLBACKS.cp_eternal_wings, description: "Wings of eternal devotion" },
          { id: "cp_dream_castle", name: "Dream Love Castle", price: 13140, icon_url: "/gifts/basic-3d/crown.png", intimacy_points: 1600, required_cp_level: 4, animation_url: CP_GIFT_ANIMATION_FALLBACKS.cp_dream_castle, description: "Royal fairy castle" },
          { id: "cp_galaxy_carriage", name: "Galaxy Carriage", price: 52000, icon_url: "/gifts/basic-3d/love-ring.png", intimacy_points: 6800, required_cp_level: 5, animation_url: CP_GIFT_ANIMATION_FALLBACKS.cp_galaxy_carriage, description: "Celestial romance carriage" },
        ];
      }
      return data;
    },
    enabled: open && activeTier === "cp",
    staleTime: 10 * 60_000,
  });

  const cpGifts = useMemo<Gift[]>(() => {
    return (cpGiftsQuery.data ?? []).map((cg) => {
      // Database animation_url is intentionally nullable until dedicated CP
      // animation files exist; always substitute a known, existing romantic
      // clip so the room player never receives a dead relative URL.
      const animationUrl = cg.animation_url || CP_GIFT_ANIMATION_FALLBACKS[cg.id] || CP_GIFT_ANIMATION_FALLBACKS.cp_rose_bouquet;
      return {
        id: cg.id,
        name: cg.name,
        icon: "💖",
        emoji: "💖",
        icon_path: cg.icon_url,
        image_url: cg.icon_url,
        price_coins: Number(cg.price),
        price: Number(cg.price),
        diamonds_value: Number(cg.price),
        category: "cp",
        animation: "video",
        clip_path: animationUrl,
        clip_type: animationUrl.toLowerCase().split(/[?#]/)[0].endsWith(".svga") ? "svga" : "mp4",
        sound_url: null,
        is_cp: true,
        intimacy_points: Number(cg.intimacy_points ?? 100),
        required_cp_level: Number(cg.required_cp_level ?? 1),
      };
    });
  }, [cpGiftsQuery.data]);

  const visibleGifts = useMemo(() => {
    if (activeTier === "cp") return cpGifts;
    return [...(gifts.data ?? [])]
      .filter((g) => {
        const p = price(g);
        return activeTier === "small" ? p >= 10 && p <= 300 : tierOf(p) === activeTier;
      })
      .sort((a, b) => price(a) - price(b));
  }, [activeTier, cpGifts, gifts.data]);

  const giftVideoUrl = (g: Gift | null) => {
    if (!g?.clip_path || !["mp4", "webm", "svga"].includes(g.clip_type ?? "")) return null;
    return resolvePlayableGiftUrl(g.clip_path);
  };

  const handleGiftSelect = useCallback((gift: Gift) => {
    setSelectedGift(gift);
    preloadGiftVideo(giftVideoUrl(gift));
  }, []);

  const send = useMutation({
    mutationFn: async ({ gift, targets, quantity }: { gift: Gift; targets: string[]; quantity: number }) => {
      const sender = { id: profile?.id ?? null, name: profile?.username ?? "Guest", avatar: profile?.avatar ?? null };

      // CP Exclusive Gift Flow
      if (gift.is_cp) {
        if (!cpPartner?.id) {
          throw new Error("You need an active CP partner to send couple gifts.");
        }
        if (!isPartnerInRoom) {
          throw new Error("Your CP partner is not inside this voice room!");
        }
        if (cpLevel < (gift.required_cp_level ?? 1)) {
          throw new Error(`Requires CP Level ${gift.required_cp_level}. Current level is ${cpLevel}.`);
        }

        const { data, error } = await supabase.rpc("cp_send_exclusive_gift", {
          p_gift_id: gift.id,
          p_message: "Romantic Love Gift",
        });
        if (error) throw error;

        const row = data as { event_id?: string; points_added?: number } | null;
        const sendId = row?.event_id ?? crypto.randomUUID();

        // Broadcast playback so everyone in the room sees and hears it
        await broadcastGiftPlayback(roomId, gift, [cpPartner.id], sender, quantity, sendId, [sendId]);

        // Announce in room chat
        try {
          await supabase.from("room_messages").insert({
            room_id: roomId,
            user_id: profile?.id,
            content: `💖 Sent CP Exclusive Gift [${gift.name}] to ${cpPartner.username ?? "CP Partner"}! (+${gift.intimacy_points ?? 100} Intimacy)`,
            kind: "gift",
            meta: {
              is_cp: true,
              gift_name: gift.name,
              partner_id: cpPartner.id,
              intimacy_points: gift.intimacy_points,
            },
          });
        } catch {
          // ignore chat error
        }

        return { gift, quantity, isCp: true };
      }

      // Standard Gifts Flow
      const uniqueTargets = [...new Set(targets)].filter(Boolean);
      if (!uniqueTargets.length) throw new Error("Pick a receiver");
      if (!allowSelfGift && profile?.id && uniqueTargets.includes(profile.id)) {
        throw new Error("You must be active on a seat before sending a gift to yourself.");
      }

      if (uniqueTargets.length === 1) {
        const { data, error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: uniqueTargets[0],
          _gift_id: gift.id,
          _quantity: quantity,
          _write_message: true,
        });
        if (error) throw error;
        const row = data as { id?: string } | null;
        if (!row?.id) throw new Error("Gift was charged but returned no canonical send id");
        await broadcastGiftPlayback(roomId, gift, uniqueTargets, sender, quantity, row.id, [row.id]);
      } else {
        const { data, error } = await supabase.rpc("send_gift_multi_current", {
          _room_id: roomId,
          _receiver_ids: uniqueTargets,
          _gift_id: gift.id,
          _quantity: quantity,
        } as any);
        if (error) throw error;
        const rows = Array.isArray(data) ? (data as Array<{ id?: string; receiver_id?: string }>) : [];
        if (rows.length !== uniqueTargets.length || rows.some((row) => !row.id)) {
          throw new Error("Gift batch returned incomplete canonical send ids");
        }
        await broadcastGiftPlayback(roomId, gift, uniqueTargets, sender, quantity, rows[0].id!, rows.map((r) => r.id!));
      }

      return { gift, quantity, isCp: false };
    },
    onSuccess: async (data) => {
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet_tx"] });
      if (data?.isCp) {
        qc.invalidateQueries({ queryKey: ["user_cp_relation"] });
        qc.invalidateQueries({ queryKey: ["cp_space"] });
        toast.success(`CP Gift sent to ${cpPartner?.username ?? "Partner"}! +${data.gift.intimacy_points ?? 100} Intimacy 💖`);
      }
      setSelectedGift(null);
      setQty(1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const effectiveTargets =
    activeTier === "cp"
      ? cpPartner?.id
        ? [cpPartner.id]
        : []
      : [...new Set((sendToAll ? receiverOptions.map((r) => r.id) : selectedReceiverIds).filter((id) => Boolean(id) && (allowSelfGift || id !== profile?.id)))];

  const totalCost = price(selectedGift) * qty * Math.max(1, effectiveTargets.length);
  const canAfford = (profile?.coins ?? 0) >= totalCost;

  const performSend = () => {
    if (!selectedGift || send.isPending) return;
    if (!allowSelfGift && profile?.id && effectiveTargets.includes(profile.id)) {
      toast.error("Seat par active hone ke baad hi aap khud ko gift kar sakte hain.");
      return;
    }
    if (activeTier === "cp") {
      if (!cpPartner) {
        toast.error("You do not have an active CP partner!");
        return;
      }
      if (!isPartnerInRoom) {
        toast.error("CP partner is not inside this room!");
        return;
      }
      if (cpLevel < (selectedGift.required_cp_level ?? 1)) {
        toast.error(`Requires CP Level ${selectedGift.required_cp_level}!`);
        return;
      }
    } else if (!effectiveTargets.length) {
      toast.error("Pick a receiver");
      return;
    }
    onClose();
    send.mutate({ gift: selectedGift, targets: effectiveTargets, quantity: qty });
  };

  const handleSend = () => {
    if (!selectedGift || send.isPending) return;
    if (!canAfford) {
      toast.error("Not enough coins");
      return;
    }
    if (tierOf(price(selectedGift)) === "vip" && activeTier !== "cp") {
      setConfirmOpen(true);
      return;
    }
    performSend();
  };

  const toggleReceiver = (id: string) => {
    if (sendToAll || activeTier === "cp" || (!allowSelfGift && id === profile?.id)) return;
    setSelectedReceiverIds((prev) => {
      if (id === profile?.id) return prev.includes(id) ? [] : [id];
      const withoutSelf = prev.filter((item) => item !== profile?.id);
      return withoutSelf.includes(id) ? withoutSelf.filter((item) => item !== id) : [...withoutSelf, id];
    });
  };

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/50 p-0 transition-opacity" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg h-[320px] flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#121212]/95 backdrop-blur-xl text-white shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        {/* Top Header: Categories */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">
              Jalwa
            </span>
            <div className="flex gap-1">
              {TIER_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTier(t);
                    setSelectedGift(null);
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black transition-all ${
                    activeTier === t
                      ? t === "cp"
                        ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/30"
                        : "bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md"
                      : "bg-white/10 text-white/70 hover:bg-white/15"
                  }`}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {activeTier === "cp" ? (
            <div className="flex items-center gap-1 rounded-lg bg-pink-500/20 border border-pink-500/40 px-2.5 py-1 text-[10px] font-bold text-pink-300">
              <Heart className="h-3 w-3 fill-pink-500 text-pink-500 animate-pulse" />
              <span>COUPLE ONLY</span>
            </div>
          ) : (
            <button
              onClick={() =>
                setSendToAll((v) => {
                  const next = !v;
                  setSelectedReceiverIds(next ? receiverOptions.map((r) => r.id).filter((id) => id !== profile?.id) : profile?.id ? [profile.id] : []);
                  return next;
                })
              }
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition ${
                sendToAll ? "bg-pink-600 text-white shadow-lg shadow-pink-600/30" : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              {sendToAll ? "ALL SELECTED" : "SEND TO ALL"}
            </button>
          )}
        </div>

        {/* Receiver Strip */}
        {activeTier === "cp" ? (
          <div className="px-3 py-1.5 border-b border-white/5 bg-black/25">
            {!cpPartner ? (
              <div className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <span className="text-[11px]">No active CP Partner linked yet</span>
                </div>
                <span className="text-[10px] text-pink-400 font-semibold">Visit CP Center</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <img
                      src={profile?.avatar ?? "https://github.com/shadcn.png"}
                      alt="You"
                      className="h-7 w-7 rounded-full border border-pink-400/80 object-cover"
                    />
                    <div className="-mx-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-pink-600 shadow-sm text-white">
                      <Heart className="h-3 w-3 fill-current" />
                    </div>
                    <img
                      src={cpPartner.avatar ?? "https://github.com/shadcn.png"}
                      alt={cpPartner.username ?? "Partner"}
                      className={`h-7 w-7 rounded-full border-2 object-cover ${
                        isPartnerInRoom
                          ? "border-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                          : "border-zinc-500 grayscale"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-white truncate max-w-[100px]">
                        {cpPartner.username ?? "Partner"}
                      </span>
                      <span className="rounded-full bg-pink-500/20 border border-pink-500/40 px-1.5 py-0.2 text-[8px] font-bold text-pink-300">
                        CP Lv.{cpLevel}
                      </span>
                    </div>
                    <div className="text-[9px] font-semibold flex items-center gap-1">
                      {isPartnerInRoom ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          In This Room (Ready to play)
                        </span>
                      ) : (
                        <span className="text-amber-400">⚠️ Partner not in this room</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-pink-300/80 font-medium block">
                    {isPartnerInRoom ? "Plays live for room" : "Must be in room"}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-b border-white/5 bg-black/20 no-scrollbar">
            {receiverOptions.map((r) => {
              const isSelected = r.id === profile?.id ? selectedReceiverIds.includes(r.id) : sendToAll || selectedReceiverIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleReceiver(r.id)}
                  className={`relative flex flex-col items-center shrink-0 transition-all ${
                    isSelected ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <div
                    className={`relative h-9 w-9 rounded-full p-0.5 ${
                      isSelected
                        ? "bg-gradient-to-tr from-pink-500 to-violet-500 shadow-sm shadow-pink-500/50"
                        : "bg-white/20"
                    }`}
                  >
                    <img
                      src={r.avatar ?? "https://github.com/shadcn.png"}
                      alt={r.username ?? "User"}
                      className="h-full w-full rounded-full object-cover bg-black"
                    />
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-pink-500 flex items-center justify-center text-[8px] font-bold text-white border border-[#121212]">
                        ✓
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-medium text-white/80 truncate max-w-[42px] mt-0.5">
                    {r.id === profile?.id ? "You" : r.username ?? "User"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Gifts Grid Area */}
        {gifts.isLoading || (activeTier === "cp" && cpGiftsQuery.isLoading) ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5 text-violet-400" />
          </div>
        ) : gifts.isError ? (
          <div className="flex-1 flex items-center justify-center text-xs text-red-300">Failed to load gifts.</div>
        ) : visibleGifts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/40">
            {activeTier === "cp" ? "No CP exclusive gifts available." : "No gifts available in this tier."}
          </div>
        ) : (
          <GiftGrid
            gifts={visibleGifts}
            selectedGiftId={selectedGift?.id ?? null}
            userCpLevel={cpLevel}
            onSelect={handleGiftSelect}
          />
        )}

        {/* Footer: Wallet balance, quantity, and Send button */}
        <div className="border-t border-white/10 bg-black/40 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-xl">
            <Coins className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
            <span className="text-xs font-black text-yellow-400">{(profile?.coins ?? 0).toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2">
            {activeTier !== "cp" && (
              <div className="flex items-center rounded-xl bg-white/10 border border-white/10 overflow-hidden">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2.5 py-1.5 text-xs hover:bg-white/10 active:scale-95 transition">
                  −
                </button>
                <span className="w-6 text-center text-xs font-bold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-2.5 py-1.5 text-xs hover:bg-white/10 active:scale-95 transition">
                  +
                </button>
              </div>
            )}

            <button
              disabled={
                !selectedGift ||
                send.isPending ||
                !canAfford ||
                (activeTier === "cp" && (!cpPartner || !isPartnerInRoom || (selectedGift.required_cp_level ?? 1) > cpLevel))
              }
              onClick={handleSend}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black text-white shadow-lg disabled:opacity-40 disabled:shadow-none active:scale-95 transition ${
                activeTier === "cp"
                  ? "bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 shadow-pink-500/30"
                  : "bg-gradient-to-r from-pink-500 to-violet-600 shadow-pink-500/25"
              }`}
            >
              {send.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : activeTier === "cp" ? (
                !cpPartner ? (
                  "No Partner"
                ) : !isPartnerInRoom ? (
                  "Partner Not In Room"
                ) : (selectedGift?.required_cp_level ?? 1) > cpLevel ? (
                  `Locked (Lv.${selectedGift?.required_cp_level})`
                ) : (
                  <>
                    <Heart className="h-3.5 w-3.5 fill-current" />
                    Send to CP {selectedGift ? `(${totalCost.toLocaleString()})` : ""}
                  </>
                )
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send {selectedGift ? `(${totalCost.toLocaleString()})` : ""}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Confirmation Modal for VIP gifts */}
        {confirmOpen && selectedGift && (
          <div
            className="fixed inset-0 z-[2147483100] grid place-items-center bg-black/70 p-5 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setConfirmOpen(false)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#1a1128] border border-white/15 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="text-base font-black text-white">Confirm VIP Gift</div>
              <p className="mt-1.5 text-xs text-white/60">
                Send <span className="text-white font-bold">{selectedGift.name}</span> for{" "}
                <span className="text-yellow-400 font-bold">{totalCost.toLocaleString()} coins</span>?
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80 hover:bg-white/15 transition"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 py-2 text-xs font-black text-white shadow-lg shadow-pink-500/25 transition"
                  onClick={() => {
                    setConfirmOpen(false);
                    performSend();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
