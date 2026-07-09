import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Loader2, Coins, Send } from "lucide-react";
import { toast } from "sonner";


export type Gift = {
  id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
  price_coins: number;
  diamonds_value: number;
  category: string | null;
  animation: string | null;
};

export type GiftReceiver = { id: string; username: string | null; avatar: string | null };

export function GiftSheet({
  open,
  onClose,
  roomId,
  receivers,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  receivers: GiftReceiver[];
}) {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(
    receivers[0]?.id ?? null,
  );
  const [sendToAll, setSendToAll] = useState(false);
  const [qty, setQty] = useState(1);

  const gifts = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Gift[];
    },
    enabled: open,
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!selectedGift) throw new Error("Pick a gift");
      const targets = sendToAll
        ? receivers.map((r) => r.id)
        : receiverId
          ? [receiverId]
          : [];
      if (targets.length === 0) throw new Error("Pick a receiver");
      for (const rid of targets) {
        const { error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: rid,
          _gift_id: selectedGift.id,
          _quantity: qty,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Gift sent 🎁");
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet_tx"] });
      setSelectedGift(null);
      setQty(1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const totalCost =
    (selectedGift?.price_coins ?? 0) *
    qty *
    (sendToAll ? Math.max(1, receivers.length) : 1);
  const canAfford = (profile?.coins ?? 0) >= totalCost;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass mx-auto w-full max-w-md rounded-t-3xl border-t border-border bg-background/95 p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Send a Gift</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-card/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receiver picker — DP-only chips + All */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            To {sendToAll ? `· All (${receivers.length})` : ""}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {receivers.length === 0 && (
              <p className="text-xs text-muted-foreground">No one on stage to gift.</p>
            )}
            {receivers.length > 1 && (
              <button
                onClick={() => setSendToAll((v) => !v)}
                aria-label="All"
                className={`shrink-0 rounded-full p-[2px] transition ${
                  sendToAll
                    ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                    : "bg-white/10"
                }`}
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-[10px] font-black">
                  ALL
                </div>
              </button>
            )}
            {receivers.map((r) => {
              const active = !sendToAll && receiverId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSendToAll(false);
                    setReceiverId(r.id);
                  }}
                  aria-label={r.username ?? "user"}
                  className={`shrink-0 rounded-full p-[2px] transition ${
                    active
                      ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                      : "bg-white/10"
                  }`}
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-card">
                    {r.avatar ? (
                      <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold">{(r.username ?? "?").slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gifts grid */}
        <div className="mb-3 max-h-[36vh] overflow-y-auto">
          {gifts.isLoading && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {gifts.data?.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGift(g)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-2 transition-colors ${
                  selectedGift?.id === g.id
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10"
                    : "border-border bg-card/40"
                }`}
              >
                <span className="text-3xl leading-none">{g.icon ?? "🎁"}</span>
                <span className="truncate text-[10px] font-semibold">{g.name}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-[color:var(--gold)]">
                  <Coins className="h-2.5 w-2.5" />
                  {g.price_coins.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Qty + Send */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
            {[1, 5, 10, 99].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  qty === n
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                x{n}
              </button>
            ))}
          </div>
          <button
            onClick={() => send.mutate()}
            disabled={!selectedGift || !receiverId || !canAfford || send.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {selectedGift
              ? `Send · ${totalCost.toLocaleString()} coins`
              : "Pick a gift"}
          </button>
        </div>
        {selectedGift && !canAfford && (
          <p className="mt-2 text-center text-[11px] text-[color:var(--destructive)]">
            Not enough coins. <Link to="/recharge" className="underline">Recharge</Link>
          </p>
        )}
      </div>
    </div>
  );
}
