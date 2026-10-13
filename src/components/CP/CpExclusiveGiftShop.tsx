import { useEffect, useState } from "react";
import { Coins, Gift, Heart, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { getCpExclusiveGifts, sendCpExclusiveGift, type CpExclusiveGift } from "./cpEcosystemApi";

type Props = { cpLevel: number; onGiftSent?: () => void };

export function CpExclusiveGiftShop({ cpLevel, onGiftSent }: Props) {
  const [gifts, setGifts] = useState<CpExclusiveGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CpExclusiveGift | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getCpExclusiveGifts()
      .then((rows) => { if (active) setGifts(rows); })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load CP gifts"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function confirmSend() {
    if (!selected || sending) return;
    try {
      setSending(true);
      const result = await sendCpExclusiveGift(selected.id);
      toast.success(`${result.gift_name} sent · ${result.points_added} intimacy added ❤️`);
      setSelected(null);
      onGiftSent?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not send CP gift");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-950/30 via-zinc-900/80 to-purple-950/30 p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-black"><Gift className="h-4 w-4 text-pink-300" /> Exclusive Couple Gifts</h2>
        <span className="text-xs text-zinc-400">Secure server-side coin charge</span>
      </div>
      {loading ? <p className="py-6 text-center text-sm text-zinc-400">Loading romantic gifts…</p> : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {gifts.map((gift) => {
            const locked = cpLevel < gift.required_cp_level;
            return (
              <article key={gift.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3.5">
                <div className="flex items-start gap-3">
                  <img src={gift.icon_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white/5 object-contain" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold">{gift.name}</h3>
                    <p className="mt-1 text-xs text-zinc-400">{gift.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 text-amber-300"><Coins className="h-3 w-3" /> {gift.price.toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1 text-pink-300"><Heart className="h-3 w-3" /> +{gift.intimacy_points}</span>
                    </div>
                  </div>
                </div>
                <button type="button" disabled={locked || sending} onClick={() => setSelected(gift)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-pink-600/90 px-3 py-2 text-xs font-black text-white hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-40">
                  {locked ? <><LockKeyhole className="h-3.5 w-3.5" /> Unlock at CP level {gift.required_cp_level}</> : "Send romantic gift"}
                </button>
              </article>
            );
          })}
          {!gifts.length && <p className="col-span-full rounded-2xl bg-zinc-950/50 p-5 text-center text-xs text-zinc-500">No exclusive gifts are available right now.</p>}
        </div>
      )}
      {selected && (
        <div role="dialog" aria-modal="true" aria-labelledby="cp-gift-confirm-title" className="fixed inset-0 z-[220] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-pink-400/30 bg-zinc-950 p-5 shadow-2xl shadow-pink-950/40">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300"><Gift className="h-6 w-6" /></div>
            <h3 id="cp-gift-confirm-title" className="text-lg font-black text-white">Send {selected.name}?</h3>
            <p className="mt-2 text-sm text-zinc-400">This will spend {selected.price.toLocaleString()} coins and add {selected.intimacy_points.toLocaleString()} intimacy. The server checks your active CP, level and balance before charging.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={sending} onClick={() => setSelected(null)} className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-bold text-zinc-300">Cancel</button>
              <button type="button" disabled={sending} onClick={() => void confirmSend()} className="rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 px-3 py-2.5 text-sm font-black text-white disabled:opacity-50">{sending ? "Sending…" : "Confirm gift"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
