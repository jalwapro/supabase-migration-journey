import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import {
  CASINO_CHIPS,
  blip,
  haptic,
  useCasinoGame,
  useCasinoPlay,
  useCasinoRecent,
  type CasinoResult,
} from "@/lib/casino";
import { CasinoPopupShell, ChipRow, WinBurst } from "./CasinoPopupShell";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function DragonTigerGame({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const cfg = useCasinoGame("dragon_tiger");
  const play = useCasinoPlay("dragon_tiger", roomId);
  const recent = useCasinoRecent("dragon_tiger", open);

  const [bet, setBet] = useState(500);
  const [pick, setPick] = useState<"dragon" | "tiger" | "tie">("dragon");
  const [result, setResult] = useState<CasinoResult | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // --- CHEAT SYSTEM STATES ---
  const [secretTaps, setSecretTaps] = useState(0);
  const [cheatActive, setCheatActive] = useState(false);
  // ---------------------------

  const balance = Number(profile?.coins ?? 0);
  const rtp = (cfg?.rtp_bp ?? 9700) / 10000;
  const sideOdds = (rtp * 13) / 6;
  const tieOdds = rtp * 13;

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // --- 24-HOUR CHEAT LOGIC ---
  const handleSecretTap = () => {
    setSecretTaps((prev) => {
      const newTaps = prev + 1;
      
      if (newTaps === 3) {
        // 24 Hours check
        const lastCheatTime = localStorage.getItem("last_cheat_time");
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (lastCheatTime && (now - parseInt(lastCheatTime) < TWENTY_FOUR_HOURS)) {
          // Agar 24 ghante pure nahi hue, toh stealth error show karein
          haptic(20);
          toast.error("Error: Code 24", {
            style: { fontSize: "11px", opacity: 0.6 } // Chota aur halka sa error
          });
          return 0; // Taps reset kar dein
        }

        // Agar 24 ghante guzar chuke hain, ya pehli dafa hai
        haptic(50); // Vibration
        setCheatActive(true); // Cheat on
        return 0; // Taps reset
      }
      return newTaps;
    });
  };
  // ---------------------------

  const deal = async () => {
    if (flipping || play.isPending) return;
    haptic();
    setFlipping(true);
    setResult(null);
    
    try {
      const payloadParams: any = { pick };
      
      // Agar cheat active hai toh key attach karo aur time save karo
      if (cheatActive) {
        payloadParams.cheatKey = "CONFIRM_WIN_777";
        // Backend user ki "pick" dekh kar usko jeetwa dega
        
        // Current time localStorage mein save kar lein 24h limit ke liye
        localStorage.setItem("last_cheat_time", Date.now().toString());
      }

      const r = await play.mutateAsync({ bet, params: payloadParams });
      blip(520, 0.08);
      
      timeoutRef.current = window.setTimeout(() => {
        setResult(r);
        setFlipping(false);
        setHistory((h) => [String(r.winner), ...h].slice(0, 14));
        blip(r.won ? 880 : 220, 0.16, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 40 : 15);
        void refresh?.();
        
        if (cheatActive) setCheatActive(false); 
      }, 900);
      
    } catch (e) {
      setFlipping(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="Dragon vs Tiger"
      icon="🐉"
      accent="#ff7a3d"
      balance={balance}
      footer={
        <div className="space-y-2">
          <ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={flipping} />
          <button
            onClick={deal}
            disabled={flipping || play.isPending}
            className={`w-full rounded-2xl py-3 text-sm font-black text-white shadow-[0_10px_30px_-10px_#10b981] transition active:scale-[0.98] disabled:opacity-50 ${
              cheatActive 
                ? "bg-gradient-to-r from-red-600 to-orange-600 shadow-red-500/50" 
                : "bg-gradient-to-r from-emerald-500 to-emerald-600"
            }`}
          >
            {flipping ? "Dealing…" : `Confirm Bet · ${formatCompact(bet)}`}
          </button>
        </div>
      }
    >
      <div className="relative">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b0a2e] to-black p-3">
          <Card side="dragon" rank={result?.dragon_card} flipping={flipping} />
          
          <div className="grid place-items-center">
            {/* HIDDEN CHEAT BUTTON */}
            <span 
              onClick={handleSecretTap}
              className="cursor-pointer select-none rounded-full border border-[color:var(--gold)]/60 bg-black px-2 py-1 text-[11px] font-black transition-colors"
              style={{
                color: cheatActive ? "#ff4444" : "var(--gold)",
                boxShadow: cheatActive ? "0 0 10px #ff4444" : "none"
              }}
            >
              VS
            </span>
          </div>

          <Card side="tiger" rank={result?.tiger_card} flipping={flipping} />
        </div>

        {/* Picks */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <PickBtn label="DRAGON" odds={sideOdds} color="#4aa3ff" active={pick === "dragon"} onClick={() => setPick("dragon")} />
          <PickBtn label="TIE" odds={tieOdds} color="#39d98a" active={pick === "tie"} onClick={() => setPick("tie")} />
          <PickBtn label="TIGER" odds={sideOdds} color="#ff7a3d" active={pick === "tiger"} onClick={() => setPick("tiger")} />
        </div>

        {/* ... (Result, History, aur Winners UI) ... */}
      </div>
    </CasinoPopupShell>
  );
}

// ... Card and PickBtn components
