import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Sparkles, Trophy, Zap, Coins, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCompact } from "@/lib/utils";
import { CASINO_CHIPS, blip, haptic, type SlotsResult } from "@/lib/casino";
import { CasinoPopupShell } from "./CasinoPopupShell";
import { WinBurst } from "./CasinoPopupShell";
import { InsufficientCoins } from "./GameBalance";

type Props = { open: boolean; onClose: () => void; roomId?: string };
const SYMBOLS = ["🍒", "🔔", "💰", "👑", "💎", "7️⃣", "⭐"];
const SYMBOL_LABELS = ["CHERRY", "BELL", "GOLD", "CROWN", "DIAMOND", "777", "STAR"];
const SYMBOL_ICONS: Record<string, string> = { cherry: "🍒", bell: "🔔", moneybag: "💰", crown: "👑", diamond: "💎", "777": "7️⃣", star: "⭐" };

type RoyalResult = SlotsResult;

export function RoyalJalwaSlots({ open, onClose, roomId }: Props) {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [bet, setBet] = useState(500);
  const [reels, setReels] = useState(["👑", "💎", "7️⃣"]);
  const [result, setResult] = useState<RoyalResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [poor, setPoor] = useState(false);
  const spinTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balance = Number(profile?.coins ?? 0);

  const play = useMutation({
    mutationFn: async ({ amount, requestId }: { amount: number; requestId: string }) => {
      const { data, error } = await supabase.rpc("royal_jalwa_slots_spin" as never, {
        p_bet: amount,
        p_request_id: requestId,
        p_room_id: roomId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as RoyalResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casino_history"] });
      qc.invalidateQueries({ queryKey: ["casino_recent"] });
    },
  });

  useEffect(() => () => {
    if (spinTimer.current) window.clearInterval(spinTimer.current);
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
  }, []);

  const spin = async () => {
    if (spinning || play.isPending) return;
    if (balance < bet) {
      setPoor(true);
      return;
    }
    haptic();
    setSpinning(true);
    setResult(null);
    spinTimer.current = window.setInterval(() => {
      setReels([0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
      blip(240 + Math.random() * 160, 0.025, "square");
    }, 85);
    try {
      const r = await play.mutateAsync({ amount: bet, requestId: crypto.randomUUID() });
      void refresh?.();
      finishTimer.current = window.setTimeout(() => {
        if (spinTimer.current) window.clearInterval(spinTimer.current);
        spinTimer.current = null;
        const serverReels = Array.isArray(r.reels) ? r.reels.slice(0, 3) : [];
        setReels(serverReels.length === 3 ? serverReels.map((symbol) => SYMBOL_ICONS[symbol] ?? symbol) : ["🍒", "🔔", "⭐"]);
        setResult(r);
        setSpinning(false);
        blip((r.payout ?? 0) > 0 ? 980 : 155, 0.18, (r.payout ?? 0) > 0 ? "sine" : "sawtooth");
        haptic((r.payout ?? 0) > 0 ? 45 : 15);
        void refresh?.();
      }, 850);
    } catch (e) {
      if (spinTimer.current) window.clearInterval(spinTimer.current);
      spinTimer.current = null;
      setSpinning(false);
      toast.error(e instanceof Error ? e.message : "Spin failed");
      void refresh?.();
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="ROYAL JALWA SLOTS"
      icon="👑"
      accent="#f5c451"
      balance={balance}
      help="Royal JALWA slot machine. The server determines every reel and payout; your real JALWA coin wallet is used."
      footer={
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {CASINO_CHIPS.map((chip) => (
              <button key={chip} type="button" disabled={spinning} onClick={() => setBet(chip)}
                className={`rounded-xl border px-2 py-2 text-xs font-black transition disabled:opacity-40 ${bet === chip ? "border-amber-300 bg-amber-300/20 text-amber-100 shadow-[0_0_15px_rgba(245,196,81,.16)]" : "border-white/10 bg-white/5 text-white/70"}`}>
                {formatCompact(chip)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-black/40 px-3 py-2 text-xs">
            <span className="text-white/55">BET PER SPIN</span>
            <span className="font-black text-amber-200">🪙 {formatCompact(bet)}</span>
          </div>
          <button type="button" onClick={spin} disabled={spinning || play.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/50 bg-gradient-to-r from-[#7b4c08] via-[#f5c451] to-[#8a5a10] py-3.5 text-sm font-black tracking-[.12em] text-black shadow-[0_0_28px_rgba(245,196,81,.22)] transition active:scale-[.99] disabled:opacity-50">
            {spinning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {spinning ? "SPINNING..." : `SPIN · ${formatCompact(bet)} COINS`}
          </button>
        </div>
      }
    >
      <div className="relative overflow-hidden rounded-[26px] border border-amber-300/45 bg-[radial-gradient(ellipse_at_50%_0%,#49300c_0%,#160f08_42%,#030303_100%)] p-4 shadow-[0_0_44px_rgba(245,196,81,.13)] sm:p-5">
        <WinBurst show={!!result && result.payout > 0} amount={result?.payout ?? 0} />
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(245,196,81,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(245,196,81,.12) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative mb-4 flex items-center justify-center gap-2">
          <Crown className="h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(245,196,81,.7)]" />
          <div className="text-center">
            <p className="text-[9px] font-black tracking-[.42em] text-amber-300/80">THE GOLDEN REELS</p>
            <h2 className="text-2xl font-black tracking-[.12em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-yellow-700 sm:text-4xl">ROYAL JALWA</h2>
          </div>
          <Crown className="h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(245,196,81,.7)]" />
        </div>

        <div className="relative rounded-[22px] border-2 border-amber-300/70 bg-gradient-to-b from-[#3b2a0c] via-[#0b0905] to-[#211605] p-2 shadow-[0_0_26px_rgba(245,196,81,.2),inset_0_0_25px_rgba(245,196,81,.08)] sm:p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[8px] font-black tracking-[.3em] text-amber-300/70">JALWA • PREMIUM SLOTS</span>
            <span className="flex items-center gap-1 text-[8px] font-black tracking-widest text-emerald-300"><Sparkles className="h-3 w-3" /> SERVER RNG</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {reels.map((symbol, i) => (
              <div key={i} className="relative grid aspect-[.8] place-items-center overflow-hidden rounded-xl border border-amber-200/65 bg-gradient-to-b from-[#fff4c5] via-[#d5b56a] to-[#75501b] shadow-[inset_0_0_0_3px_rgba(0,0,0,.35),0_0_18px_rgba(245,196,81,.16)]">
                <div className="absolute inset-x-0 top-0 h-1/4 bg-white/15" />
                <span className={`relative select-none text-5xl drop-shadow-[0_3px_3px_rgba(0,0,0,.65)] sm:text-7xl ${spinning ? "blur-[1px]" : ""}`}>{symbol}</span>
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-black/10" />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => <span key={i} className={`h-1 w-5 rounded-full ${spinning ? "animate-pulse bg-amber-200" : "bg-amber-400/50"}`} />)}
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <Stat label="YOUR BALANCE" value={formatCompact(balance)} />
          <Stat label="LAST WIN" value={formatCompact(result?.payout ?? 0)} />
          <Stat label="JACKPOT POOL" value={formatCompact(result?.jackpot ?? 100000)} />
        </div>

        <div className="relative mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {SYMBOLS.map((symbol, i) => (
            <div key={symbol} className="rounded-xl border border-amber-300/20 bg-black/45 px-1 py-2 text-center">
              <span className="text-xl sm:text-2xl">{symbol}</span>
              <p className="mt-1 text-[7px] font-black tracking-wider text-amber-200/75 sm:text-[9px]">{SYMBOL_LABELS[i]}</p>
            </div>
          ))}
        </div>

        {result && (
          <div className={`relative mt-3 flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-xs font-black ${result.payout > 0 ? "border-emerald-400/60 bg-emerald-950/50 text-emerald-200" : "border-rose-400/40 bg-rose-950/35 text-rose-200"}`}>
            {result.payout > 0 ? <Trophy className="h-4 w-4 text-amber-300" /> : <Coins className="h-4 w-4" />}
            <span>{result.payout > 0 ? `WIN · +${formatCompact(result.payout)} COINS` : `NO WIN · -${formatCompact(result.bet)} COINS`}</span>
            {result.is_jackpot && <span className="text-amber-300">JACKPOT!</span>}
            {!!result.free_spins_awarded && <span className="text-cyan-300">+{result.free_spins_awarded} FREE SPINS</span>}
          </div>
        )}
        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-amber-300/25 bg-black/55 p-2 text-center">
    <p className="text-[8px] font-black tracking-widest text-amber-200/70">{label}</p>
    <p className="mt-1 text-sm font-black text-white sm:text-lg">🪙 {value}</p>
  </div>;
}
