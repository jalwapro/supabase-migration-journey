import { useEffect, useState } from "react";
import { formatCompact } from "@/lib/utils";

/** Gold win burst with a count-up and a light coin shower. */
export function WinAnimation({ show, amount }: { show: boolean; amount: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!show) return setN(0);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 650);
      setN(Math.floor(amount * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, amount]);

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden">
      <div className="animate-scale-in rounded-2xl border border-[color:var(--gold)]/60 bg-black/80 px-6 py-4 text-center shadow-[0_0_50px_-6px_var(--gold)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">You win</p>
        <p className="text-3xl font-black text-[color:var(--gold)]">+{formatCompact(n)}</p>
      </div>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-lg"
          style={{
            left: `${5 + (i * 6.8) % 90}%`,
            top: "-8%",
            animation: `jalwa-coin-fall ${1 + (i % 5) * 0.22}s linear ${(i % 7) * 0.08}s 1 forwards`,
          }}
        >
          🪙
        </span>
      ))}
      <style>{`@keyframes jalwa-coin-fall{0%{transform:translateY(-10%) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(620px) rotate(340deg);opacity:0}}`}</style>
    </div>
  );
}
