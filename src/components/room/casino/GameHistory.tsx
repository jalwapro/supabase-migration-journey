import { formatCompact } from "@/lib/utils";
import { useCasinoMyHistory } from "@/lib/casino";
import { X, Loader2 } from "lucide-react";

/** Shared round-history popup — every game gets the same one. */
export function GameHistory({
  open,
  onClose,
  game,
  title,
}: {
  open: boolean;
  onClose: () => void;
  game: string;
  title: string;
}) {
  const { data, isLoading } = useCasinoMyHistory(game, open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-[380px] animate-scale-in flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#120624] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-black text-white">{title} · History</p>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading && (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="py-8 text-center text-xs text-white/50">No rounds yet.</p>
          )}
          <ul className="space-y-2">
            {(data ?? []).map((r) => {
              const won = Number(r.payout) > 0;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white/80">
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-white/45">Bet {formatCompact(Number(r.bet))}</p>
                  </div>
                  <p className={`text-xs font-black ${won ? "text-emerald-400" : "text-red-400"}`}>
                    {won ? `Win +${formatCompact(Number(r.payout))}` : "Loss"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
