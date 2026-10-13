import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { getCpRings, sendCpProposalV2, type CpRing } from "./cpEcosystemApi";
import { toast } from "sonner";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { id: string; username?: string | null; avatar?: string | null };
  prelinkCoins?: number;
  onSuccess?: () => void;
};

export function CpRingSelectorModal({ isOpen, onClose, targetUser, prelinkCoins = 0, onSuccess }: Props) {
  const [rings, setRings] = useState<CpRing[]>([]);
  const [selectedRingId, setSelectedRingId] = useState("silver_ring");
  const [message, setMessage] = useState("Will you be my CP in JALWA? ❤️");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    getCpRings()
      .then((data) => {
        if (!active) return;
        setRings(data);
        if (data.length > 0) setSelectedRingId((current) => data.some((ring) => ring.id === current) ? current : data[0].id);
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load rings");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedRing = rings.find((ring) => ring.id === selectedRingId);
  const isWaived = (selectedRing?.price ?? 0) <= Math.max(0, prelinkCoins);

  const handleSendProposal = async () => {
    if (!targetUser.id || !selectedRing) {
      toast.error("Choose a valid ring and partner first.");
      return;
    }
    try {
      setSubmitting(true);
      const result = await sendCpProposalV2(targetUser.id, selectedRing.id, message);
      const fee = typeof result.fee_paid === "number" ? result.fee_paid : selectedRing.price;
      toast.success(fee === 0 ? "CP proposal sent with no ring fee!" : `Proposal sent with ${result.ring_name || selectedRing.name}!`);
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to send proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cp-ring-title" className="relative my-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-pink-500/30 bg-[#120e18] p-5 text-white shadow-2xl sm:p-6">
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close ring selector" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          {targetUser.avatar ? (
            <img src={targetUser.avatar} alt="" className="mx-auto h-12 w-12 rounded-2xl border border-pink-400/30 object-cover" />
          ) : (
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-500/20 text-2xl">💍</span>
          )}
          <h2 id="cp-ring-title" className="mt-2 text-xl font-black">Choose a Proposal Ring</h2>
          <p className="text-xs text-zinc-400">Proposing to @{targetUser.username || "Partner"}</p>
        </div>

        {prelinkCoins > 0 && (
          <div className="mt-4 rounded-xl border border-pink-500/20 bg-pink-500/10 p-2.5 text-center text-xs text-pink-300">
            💖 Your qualifying romantic gifts may waive the ring fee. Final eligibility is verified securely by JALWA.
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {loading ? (
            <div className="grid place-items-center gap-2 py-8 text-sm text-zinc-400"><Sparkles className="h-6 w-6 animate-spin text-pink-300" /> Loading rings…</div>
          ) : rings.length === 0 ? (
            <p className="rounded-xl border border-white/10 p-4 text-center text-sm text-zinc-400">No proposal rings are available right now.</p>
          ) : rings.map((ring) => {
            const waived = ring.price <= Math.max(0, prelinkCoins);
            const active = ring.id === selectedRingId;
            return (
              <button key={ring.id} type="button" aria-pressed={active} onClick={() => setSelectedRingId(ring.id)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${active ? "border-pink-500 bg-pink-950/40 shadow-lg shadow-pink-500/10" : "border-white/10 bg-zinc-950/60 hover:border-white/20"}`}>
                <span className="flex min-w-0 items-center gap-3">
                  {ring.icon_url ? <img src={ring.icon_url} alt="" className="h-10 w-10 shrink-0 object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="text-2xl">{ring.id === "diamond_ring" ? "💎" : ring.id === "gold_ring" ? "👑" : "💍"}</span>}
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">{ring.name}
                      {ring.broadcast_banner && <span className="rounded bg-gradient-to-r from-amber-400 to-rose-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-black">Global Broadcast</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-400">{ring.description}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-bold">{waived ? <span className="text-emerald-400">Potentially free</span> : <span className="text-pink-300">{ring.price.toLocaleString()} Coins</span>}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="cp-proposal-message" className="text-xs font-bold text-zinc-400">Romantic Message</label>
          <input id="cp-proposal-message" type="text" maxLength={240} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none" />
        </div>

        <button type="button" disabled={loading || submitting || !selectedRing} onClick={() => void handleSendProposal()} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 py-3 text-sm font-black text-white shadow-xl shadow-pink-500/25 transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50">
          {submitting ? "Sending Proposal…" : loading ? "Loading rings…" : !selectedRing ? "No rings available" : isWaived ? "Send Proposal (Fee May Be Waived) ❤️" : `Send Proposal (${selectedRing.price.toLocaleString()} Coins)`}
        </button>
      </div>
    </div>
  );
}
