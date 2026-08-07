import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, HelpCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * SlotsGamePopup.tsx — "Jalwa 777 Slots"
 * ----------------------------------------
 * Native slot machine (not an admin-added iframe link) using the app's
 * real coin balance. Every spin is decided by the `slots_spin` Postgres
 * function — this component only sends the bet and renders the result;
 * it never invents a win on its own.
 *
 * Popup sizing follows the "App Size Guide": 92% width, 78% height,
 * 24px corner radius, centered, ~75px gap from the bottom of the screen
 * (so it never covers the mic/gift/more footer).
 *
 * INTEGRATION — same pattern as Ludo, add a tile in RoomGamesSheet's
 * GamesPicker and wire state in room.$roomId.tsx:
 *
 *   const [slotsOpen, setSlotsOpen] = useState(false);
 *   ...
 *   <SlotsGamePopup open={slotsOpen} onClose={() => setSlotsOpen(false)} roomId={roomId} />
 *
 * In RoomGamesSheet's picker, add a tile next to "Ludo Battle":
 *   <button onClick={onOpenSlots}>🎰 777 Slots</button>
 */

const SYMBOL_ICON: Record<string, string> = {
  cherry: "🍒",
  bell: "🔔",
  moneybag: "💰",
  crown: "👑",
  diamond: "💎",
  "777": "7️⃣",
  star: "⭐",
};

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000, 10000];

type SpinResult = {
  reels: string[];
  bet: number;
  was_free_spin: boolean;
  payout: number;
  is_jackpot: boolean;
  free_spins_awarded: number;
  free_spins_remaining: number;
  balance: number;
  jackpot: number;
};

type Winner = { username: string; payout: number; created_at: string };

export function SlotsGamePopup({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const [bet, setBet] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[]>(["777", "777", "777"]);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [freeSpins, setFreeSpins] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const autoStopRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    void loadJackpotAndWinners();
  }, [open]);

  useEffect(() => {
    autoStopRef.current = !autoSpin;
  }, [autoSpin]);

  const loadJackpotAndWinners = async () => {
    const { data: jp } = await supabase.from("slots_jackpot").select("current_value").eq("id", true).maybeSingle();
    if (jp) setJackpot(jp.current_value as number);

    const { data: spins } = await supabase
      .from("slots_spins")
      .select("payout, created_at, profiles:user_id(username)")
      .gt("payout", 0)
      .order("created_at", { ascending: false })
      .limit(5);
    if (spins) {
      setWinners(
        (spins as any[]).map((s) => ({
          username: s.profiles?.username ?? "Player",
          payout: s.payout,
          created_at: s.created_at,
        }))
      );
    }
  };

  if (!open) return null;

  const balance = profile?.coins ?? 0;
  const canSpin = !spinning && (freeSpins > 0 || balance >= bet);

  const spin = async () => {
    if (!canSpin) {
      if (balance < bet) toast.error("Not enough coins for this bet");
      return;
    }
    setSpinning(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.rpc("slots_spin", {
        p_bet: bet,
        p_room_id: roomId ?? null,
      });
      if (error) throw error;
      const result = data as SpinResult;

      // brief spin animation before showing the real result
      await new Promise((r) => setTimeout(r, 550));
      setReels(result.reels);
      setLastResult(result);
      setJackpot(result.jackpot);
      setFreeSpins(result.free_spins_remaining);
      void refresh();

      if (result.is_jackpot) toast.success(`🎉 JACKPOT! +${result.payout.toLocaleString()} coins`);
      else if (result.payout > 0) toast.success(`+${result.payout.toLocaleString()} coins`);
      if (result.free_spins_awarded > 0) toast(`+${result.free_spins_awarded} free spins!`);

      if (result.payout > 0) void loadJackpotAndWinners();
    } catch (e: any) {
      toast.error(e.message ?? "Spin failed");
      setAutoSpin(false);
    } finally {
      setSpinning(false);
    }
  };

  const toggleAutoSpin = async () => {
    if (autoSpin) {
      setAutoSpin(false);
      return;
    }
    setAutoSpin(true);
    autoStopRef.current = false;
    while (!autoStopRef.current) {
      const ok = (freeSpins > 0 || (profile?.coins ?? 0) >= bet);
      if (!ok) break;
      await spin();
      await new Promise((r) => setTimeout(r, 900));
      if (autoStopRef.current) break;
    }
    setAutoSpin(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative flex flex-col rounded-[24px] border border-[#F0C674]/30 bg-gradient-to-b from-[#2a1440] to-[#160a24] shadow-[0_0_50px_rgba(240,198,116,0.15)]"
        style={{ width: "92%", height: "78%", marginBottom: "75px" }}
      >
        {/* top bar */}
        <div className="flex items-center justify-between px-4 pt-4">
          <button
            aria-label="How to play"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <p className="text-base font-black text-[#F0C674]">Jalwa 777 Slots</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* jackpot */}
        <div className="mx-4 mt-2 flex items-center justify-between rounded-xl border border-[#F0C674]/40 bg-[#F0C674]/10 px-3 py-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#F0C674]">Jackpot</span>
          <span className="text-sm font-black text-[#F0C674]">
            {jackpot !== null ? jackpot.toLocaleString() : "—"}
          </span>
        </div>

        {/* balance / win */}
        <div className="mx-4 mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Balance" value={balance.toLocaleString()} />
          <Stat
            label="Win"
            value={lastResult ? lastResult.payout.toLocaleString() : "0"}
            highlight={!!lastResult && lastResult.payout > 0}
          />
          <Stat label="Free Spins" value={String(freeSpins)} highlight={freeSpins > 0} />
        </div>

        {/* reels */}
        <div className="mx-4 mt-3 flex flex-1 items-center justify-center">
          <div className="grid grid-cols-3 gap-3 rounded-2xl border-4 border-[#F0C674]/60 bg-black/40 p-4">
            {reels.map((sym, i) => (
              <div
                key={i}
                className={`grid h-20 w-20 place-items-center rounded-xl bg-[#1a0f2e] text-4xl transition-transform ${
                  spinning ? "animate-bounce" : ""
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {SYMBOL_ICON[sym] ?? "❔"}
              </div>
            ))}
          </div>
        </div>

        {/* bet controls */}
        <div className="mx-4 mb-2 flex items-center gap-2">
          <button
            onClick={() => setBet((b) => Math.max(CHIP_VALUES[0], b - 10))}
            className="h-9 w-9 shrink-0 rounded-lg border border-white/15 text-white/80"
          >
            −
          </button>
          <div className="flex-1 rounded-lg border border-white/15 bg-black/30 py-2 text-center text-sm font-bold text-white">
            Bet: {bet.toLocaleString()}
          </div>
          <button
            onClick={() => setBet((b) => b + 10)}
            className="h-9 w-9 shrink-0 rounded-lg border border-white/15 text-white/80"
          >
            +
          </button>
        </div>

        <div className="mx-4 mb-3 flex gap-1.5 overflow-x-auto">
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => setBet(v)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                bet === v
                  ? "border-[#F0C674] bg-[#F0C674]/20 text-[#F0C674]"
                  : "border-white/15 text-white/60"
              }`}
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>

        {/* spin / max bet / auto spin */}
        <div className="mx-4 mb-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setBet(CHIP_VALUES[CHIP_VALUES.length - 1])}
            className="rounded-xl border border-white/15 py-2 text-xs font-bold text-white/80"
          >
            Max Bet
          </button>
          <button
            onClick={spin}
            disabled={!canSpin}
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 py-2 text-sm font-black uppercase tracking-wider text-black disabled:opacity-40"
          >
            {spinning ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Spin"}
          </button>
          <button
            onClick={toggleAutoSpin}
            className={`rounded-xl border py-2 text-xs font-bold ${
              autoSpin ? "border-emerald-400 text-emerald-400" : "border-white/15 text-white/80"
            }`}
          >
            {autoSpin ? "Stop" : "Auto Spin"}
          </button>
        </div>

        {/* recent winners */}
        {winners.length > 0 && (
          <div className="mx-4 mb-3 max-h-16 overflow-y-auto rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
            {winners.map((w, i) => (
              <div key={i} className="flex justify-between text-[11px] text-white/60">
                <span>{w.username}</span>
                <span className="text-[#F0C674]">+{w.payout.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${highlight ? "border-[#F0C674]/60 bg-[#F0C674]/10" : "border-white/10 bg-black/20"}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className={`truncate text-sm font-black ${highlight ? "text-[#F0C674]" : "text-white/90"}`}>{value}</p>
    </div>
  );
}
