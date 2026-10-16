import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Lock, Sparkles, Send, Coins, Gift } from "lucide-react";

export interface CpExclusiveGiftItem {
  id: string;
  name: string;
  price: number;
  icon_url: string;
  intimacy_points: number;
  required_cp_level: number;
  animation_url?: string;
  description?: string;
}

export interface CpExclusiveGiftsProps {
  partner?: { id: string; username: string; avatar?: string } | null;
  cpLevel: number;
  userCoins: number;
  onGiftSent?: (result: {
    giftName: string;
    pointsAdded: number;
    newIntimacy: number;
    newLevel: number;
    animationUrl?: string;
  }) => void;
  onRechargeNeeded?: () => void;
}

/** CP-only romantic gift catalogue. Wallet deductions and intimacy awards are handled by the server RPC. */
export const CpExclusiveGifts: React.FC<CpExclusiveGiftsProps> = ({
  partner,
  cpLevel,
  userCoins,
  onGiftSent,
  onRechargeNeeded,
}) => {
  const [gifts, setGifts] = useState<CpExclusiveGiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedIcons, setFailedIcons] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCpGifts() {
      setLoading(true);
      const { data, error } = await supabase
        .from("cp_exclusive_gifts_config")
        .select("id,name,price,icon_url,intimacy_points,required_cp_level,animation_url,description")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (error) {
        setErrorMsg("Exclusive gifts could not be loaded. Please try again.");
      } else {
        const rows = (data ?? []) as CpExclusiveGiftItem[];
        setGifts(rows);
        setSelectedGiftId((current) =>
          current && rows.some((gift) => gift.id === current) ? current : rows[0]?.id ?? null,
        );
      }
      setLoading(false);
    }

    void fetchCpGifts();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedGift = gifts.find((gift) => gift.id === selectedGiftId);

  const handleSend = async () => {
    if (sending || !selectedGift) return;

    if (!partner) {
      setErrorMsg("You need an active CP partner to send couple gifts.");
      return;
    }
    if (cpLevel < selectedGift.required_cp_level) {
      setErrorMsg(`Requires CP Level ${selectedGift.required_cp_level}.`);
      return;
    }
    if (userCoins < selectedGift.price) {
      if (onRechargeNeeded) onRechargeNeeded();
      else setErrorMsg(`Insufficient coins. Need ${selectedGift.price.toLocaleString()} coins.`);
      return;
    }

    setSending(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc("cp_send_exclusive_gift", {
        p_gift_id: selectedGift.id,
        p_message: "Romantic Love Gift",
      });

      if (error) {
        setErrorMsg(error.message || "Failed to send gift.");
        return;
      }

      const result = data as {
        success?: boolean;
        points_added?: number;
        new_intimacy?: number;
        new_level?: number;
        animation_url?: string;
        message?: string;
        error?: string;
      } | null;

      if (!result || result.success === false || result.error) {
        setErrorMsg(result?.error || result?.message || "The gift could not be sent.");
        return;
      }

      onGiftSent?.({
        giftName: selectedGift.name,
        pointsAdded: result.points_added ?? selectedGift.intimacy_points,
        newIntimacy: result.new_intimacy ?? 0,
        newLevel: result.new_level ?? cpLevel,
        animationUrl: result.animation_url ?? selectedGift.animation_url,
      });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error sending gift.");
    } finally {
      setSending(false);
    }
  };

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-zinc-950/80 p-8 text-center text-white">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400">
          <Heart className="h-8 w-8" />
        </div>
        <h4 className="mt-4 text-base font-bold">Couple Exclusives Locked</h4>
        <p className="mt-1 max-w-xs text-xs text-zinc-400">
          Form a CP relationship to unlock romantic gifts and shared intimacy.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-zinc-950/90 p-4 text-white">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-900/40 via-purple-900/30 to-zinc-900/40 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={partner.avatar || "/placeholder-avatar.png"}
            alt={partner.username}
            className="h-10 w-10 shrink-0 rounded-full border-2 border-pink-400 object-cover shadow-md"
            onError={(event) => {
              event.currentTarget.src = "/placeholder-avatar.png";
            }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-400">Sending to CP:</span>
              <span className="truncate text-sm font-black text-pink-200">{partner.username}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-pink-400">
              <Heart className="h-3 w-3 fill-current" /> CP Level {cpLevel}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/40 px-3 py-1 text-xs font-bold text-amber-300">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          <span>{userCoins.toLocaleString()}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-500">Loading exclusive gifts…</div>
      ) : gifts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-center">
          <Gift className="mx-auto h-8 w-8 text-pink-400" />
          <p className="mt-2 text-sm font-semibold text-zinc-200">No exclusive gifts available</p>
          <p className="mt-1 text-xs text-zinc-500">Please try again later.</p>
        </div>
      ) : (
        <div className="grid max-h-64 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
          {gifts.map((gift) => {
            const isSelected = gift.id === selectedGiftId;
            const isLocked = cpLevel < gift.required_cp_level;
            const iconFailed = failedIcons.includes(gift.id);

            return (
              <button
                key={gift.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedGiftId(gift.id);
                  setErrorMsg(null);
                }}
                className={`group relative flex flex-col items-center rounded-2xl border p-3 text-center transition-all ${isSelected ? "border-pink-500 bg-pink-500/15 shadow-lg shadow-pink-500/10" : "border-white/5 bg-zinc-900/60 hover:border-white/20"} ${isLocked ? "opacity-70" : ""}`}
              >
                {isLocked && (
                  <div className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">
                    <Lock className="h-2.5 w-2.5" /> Lv.{gift.required_cp_level}
                  </div>
                )}
                <div className="absolute right-2 top-2 rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[9px] font-black text-pink-300">
                  +{gift.intimacy_points}
                </div>
                <div className="my-2 grid h-14 w-14 place-items-center">
                  {gift.icon_url && !iconFailed ? (
                    <img
                      src={gift.icon_url}
                      alt={gift.name}
                      className="max-h-12 max-w-12 object-contain transition-transform group-hover:scale-110"
                      onError={() => setFailedIcons((current) => [...current, gift.id])}
                    />
                  ) : (
                    <Gift className="h-8 w-8 text-pink-400" />
                  )}
                </div>
                <span className="w-full truncate text-xs font-bold text-zinc-200">{gift.name}</span>
                {gift.description && (
                  <span className="mt-1 line-clamp-2 text-[10px] text-zinc-500">{gift.description}</span>
                )}
                <div className="mt-1 flex items-center gap-1 text-[11px] font-black text-amber-300">
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span>{gift.price.toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-center text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {selectedGift && !loading && (
        <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs">
            <span className="text-zinc-400">Award: </span>
            <span className="font-bold text-pink-300">+{selectedGift.intimacy_points} Intimacy Points</span>
            {selectedGift.animation_url && (
              <span className="mt-1 flex items-center gap-1 text-[10px] text-purple-300">
                <Sparkles className="h-3 w-3" /> Exclusive animation
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={sending || cpLevel < selectedGift.required_cp_level}
            onClick={() => void handleSend()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-pink-500/25 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <span>Sending…</span>
            ) : cpLevel < selectedGift.required_cp_level ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Locked (Lv.{selectedGift.required_cp_level})</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send to Partner</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CpExclusiveGifts;
