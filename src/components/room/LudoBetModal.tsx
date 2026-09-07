import { Coins, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const LUDO_BET_OPTIONS = [100, 500, 1000, 5000] as const;

export function LudoBetModal({
  open,
  balance,
  onClose,
  onConfirm,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
  onConfirm: (bet: number) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<number>(100);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const confirm = async () => {
    if (balance < selected) {
      toast.error(`Not enough coins. You have ${balance.toLocaleString()} coins.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start Ludo match");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[390px] rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">Ludo Bet</h3>
            <p className="mt-1 text-xs text-muted-foreground">Choose your entry stake.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full border border-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Wallet balance</span>
            <span className="flex items-center gap-1 font-black text-[color:var(--gold)]">
              <Coins className="h-3.5 w-3.5" /> {balance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {LUDO_BET_OPTIONS.map((amount) => {
            const affordable = balance >= amount;
            return (
              <button
                key={amount}
                type="button"
                disabled={!affordable || busy}
                onClick={() => setSelected(amount)}
                className={`rounded-2xl border px-4 py-4 text-left transition active:scale-[.98] ${
                  selected === amount
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15"
                    : "border-border bg-background/40"
                } ${!affordable ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <span className="block text-base font-black">{amount.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">coins</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={busy || balance < selected}
          onClick={confirm}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--primary)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm {selected.toLocaleString()} coin bet
        </button>
      </div>
    </div>
  );
}
