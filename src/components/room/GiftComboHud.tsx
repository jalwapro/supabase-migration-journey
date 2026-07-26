import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * TikTok-style combo HUD: shows a ×N counter and golden `+coins` popup on
 * the right side of the screen while a combo is in progress. Resets after
 * a short idle window.
 */
type Combo = {
  giftKey: string; // sender|gift signature
  giftName: string;
  count: number;
  totalCoins: number;
  lastAt: number;
};

type GiftEvt = {
  key: string;
  senderName: string;
  giftName: string;
  giftEmoji: string;
  coins: number;
  quantity: number;
};

const IDLE_MS = 1800;

export default function GiftComboHud() {
  const [combo, setCombo] = useState<Combo | null>(null);
  const [pop, setPop] = useState<{ id: number; amount: number } | null>(null);
  const idleRef = useRef<number | null>(null);
  const popIdRef = useRef(0);

  useEffect(() => {
    const onGift = (event: Event) => {
      const d = (event as CustomEvent<GiftEvt>).detail;
      if (!d) return;
      const sig = `${d.senderName}|${d.giftName}`;
      const now = Date.now();
      const qty = Math.max(1, Math.floor(d.quantity || 1));
      const coins = Math.max(0, Math.floor(d.coins || 0));
      setCombo((prev) => {
        if (prev && prev.giftKey === sig && now - prev.lastAt < IDLE_MS) {
          return { ...prev, count: prev.count + qty, totalCoins: prev.totalCoins + coins, lastAt: now };
        }
        return { giftKey: sig, giftName: d.giftName, count: qty, totalCoins: coins, lastAt: now };
      });
      if (coins > 0) {
        popIdRef.current += 1;
        setPop({ id: popIdRef.current, amount: coins });
      }
      if (idleRef.current) window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => setCombo(null), IDLE_MS + 200);
    };
    window.addEventListener("jalwa:gift-sent", onGift as EventListener);
    return () => {
      window.removeEventListener("jalwa:gift-sent", onGift as EventListener);
      if (idleRef.current) window.clearTimeout(idleRef.current);
    };
  }, []);

  if (typeof document === "undefined") return null;
  if (!combo) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-1/2 z-[2147483645] -translate-y-1/2 flex flex-col items-end gap-2"
      aria-live="polite"
    >
      <div
        key={combo.count}
        className="rounded-2xl bg-gradient-to-br from-[#ffd76a] via-[#ff8ac2] to-[#7a2bff] px-4 py-2 shadow-[0_10px_36px_rgba(255,120,200,.55)] ring-2 ring-white/40 animate-[jalwaComboPop_.42s_cubic-bezier(.2,.7,.3,1)]"
        style={{ WebkitTextStroke: "1px rgba(0,0,0,.35)" }}
      >
        <div className="text-[11px] font-black uppercase tracking-widest text-white/90 leading-none">Combo</div>
        <div className="text-[38px] font-black leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]">
          ×{combo.count}
        </div>
      </div>
      {pop && (
        <div
          key={pop.id}
          className="rounded-full bg-gradient-to-r from-[#ffd76a] to-[#ff8f2b] px-3 py-1 text-[13px] font-black text-black shadow-[0_6px_18px_rgba(255,180,60,.65)] ring-1 ring-white/60 animate-[jalwaComboCoin_.9s_ease-out_forwards]"
        >
          🪙 +{pop.amount.toLocaleString()}
        </div>
      )}
    </div>,
    document.body,
  );
}
