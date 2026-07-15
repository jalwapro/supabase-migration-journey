import { useEffect, useMemo, useState } from "react";

/**
 * CinematicGiftFX — 9-phase Hollywood-style overlay that wraps around the
 * existing gift media (rendered by GiftAnimationPlayer). Pure CSS / DOM,
 * layered under the gift image so the media stays crisp.
 *
 * Phases (driven by elapsed ms since mount):
 *   0-450   entry     — light-speed streaks + shockwave zoom-in
 *   450-1400 buildup  — orbiting particle ring + gathering glow
 *   1400-2100 hero    — radial pulse + camera-shake accent
 *   2100-3400 takeover— full-screen petal/particle rain
 *   3400-end  room fx — aurora tint + drifting motes
 * Camera cinematic (bloom + vignette) + rarity title run for the full duration.
 * Exit fade handled by parent unmount + CSS fade.
 */

export type CinematicTier = "basic" | "luxury" | "epic" | "mythic" | "legendary";

export function coinsToTier(coins: number, quantity: number): CinematicTier {
  const total = coins * Math.max(1, quantity);
  if (total >= 5000) return "legendary";
  if (total >= 2000) return "mythic";
  if (total >= 500) return "epic";
  if (total >= 100) return "luxury";
  return "basic";
}

export function comboTier(qty: number): 1 | 10 | 99 | 520 | 1314 {
  if (qty >= 1314) return 1314;
  if (qty >= 520) return 520;
  if (qty >= 99) return 99;
  if (qty >= 10) return 10;
  return 1;
}

const TIER_META: Record<CinematicTier, { label: string; from: string; to: string; accent: string }> = {
  basic:     { label: "Gift",           from: "#a78bfa", to: "#f472b6", accent: "#facc15" },
  luxury:    { label: "Luxury Gift",    from: "#facc15", to: "#f472b6", accent: "#fde68a" },
  epic:      { label: "Epic Gift",      from: "#f0abfc", to: "#a855f7", accent: "#fde68a" },
  mythic:    { label: "Mythic Gift",    from: "#fbbf24", to: "#ef4444", accent: "#fef08a" },
  legendary: { label: "Legendary Gift", from: "#fef08a", to: "#f97316", accent: "#fff7cc" },
};

function useElapsed() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      setElapsed(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return elapsed;
}

export function CinematicGiftFX({
  tier,
  combo,
  giftKey,
}: {
  tier: CinematicTier;
  combo: 1 | 10 | 99 | 520 | 1314;
  giftKey: string;
}) {
  const elapsed = useElapsed();
  const meta = TIER_META[tier];

  // Particle counts scale with tier and combo.
  const density = useMemo(() => {
    const base = tier === "legendary" ? 80 : tier === "mythic" ? 60 : tier === "epic" ? 40 : tier === "luxury" ? 24 : 12;
    const mult = combo >= 1314 ? 2.2 : combo >= 520 ? 1.8 : combo >= 99 ? 1.4 : combo >= 10 ? 1.15 : 1;
    return Math.round(base * mult);
  }, [tier, combo]);

  const streaks = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  const orbits = useMemo(() => Array.from({ length: Math.min(24, density) }, (_, i) => i), [density]);
  const petals = useMemo(() => Array.from({ length: density }, (_, i) => i), [density]);
  const motes = useMemo(() => Array.from({ length: Math.round(density * 0.6) }, (_, i) => i), [density]);

  const phase =
    elapsed < 450 ? "entry" :
    elapsed < 1400 ? "buildup" :
    elapsed < 2100 ? "hero" :
    elapsed < 3400 ? "takeover" : "room";

  return (
    <div
      key={giftKey}
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
      style={{
        // Expose theme colors to child CSS
        ["--fx-from" as string]: meta.from,
        ["--fx-to" as string]: meta.to,
        ["--fx-accent" as string]: meta.accent,
      }}
    >
      {/* ==== ROOM EFFECT: aurora tint + vignette (whole duration) ==== */}
      <div className="cine-room-aurora absolute inset-0" />
      <div className="cine-vignette absolute inset-0" />

      {/* Entry streaks/shockwave removed — user asked to skip the pre-gift flash */}


      {/* ==== PHASE 2: BUILDUP — orbiting particle ring ==== */}
      {(phase === "buildup" || phase === "hero") && (
        <div className="absolute inset-0">
          {orbits.map((i) => {
            const angle = (i / orbits.length) * 360;
            return (
              <span
                key={i}
                className="cine-orbit absolute left-1/2 top-1/2 block h-2 w-2 rounded-full"
                style={{
                  ["--angle" as string]: `${angle}deg`,
                  background: i % 2 ? meta.accent : meta.from,
                  animationDelay: `${(i % 6) * 60}ms`,
                }}
              />
            );
          })}
          <div className="cine-buildup-glow absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </div>
      )}

      {/* ==== PHASE 3: HERO — radial pulse + camera shake ==== */}
      {phase === "hero" && (
        <>
          <div className="cine-hero-pulse absolute left-1/2 top-1/2" />
          <div className="cine-hero-flash absolute inset-0" />
        </>
      )}

      {/* ==== PHASE 4: FULL-SCREEN TAKEOVER — petal/particle rain ==== */}
      {(phase === "takeover" || phase === "room") && (
        <div className="absolute inset-0">
          {petals.map((i) => {
            const left = (i * 97) % 100;
            const delay = (i * 53) % 1400;
            const dur = 2600 + ((i * 131) % 1800);
            const size = 6 + ((i * 17) % 14);
            const isPetal = i % 3 === 0;
            return (
              <span
                key={i}
                className="cine-petal absolute -top-6"
                style={{
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size * (isPetal ? 1.6 : 1)}px`,
                  background: isPetal
                    ? `radial-gradient(circle at 30% 30%, ${meta.to}, ${meta.from} 70%, transparent)`
                    : meta.accent,
                  borderRadius: isPetal ? "60% 40% 55% 45% / 50% 55% 45% 50%" : "50%",
                  animationDelay: `${delay}ms`,
                  animationDuration: `${dur}ms`,
                  boxShadow: `0 0 12px ${meta.accent}`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ==== ROOM: drifting motes for the tail ==== */}
      {phase === "room" && (
        <div className="absolute inset-0">
          {motes.map((i) => {
            const left = (i * 41) % 100;
            const top = (i * 73) % 100;
            const dur = 3200 + ((i * 191) % 2200);
            return (
              <span
                key={i}
                className="cine-mote absolute h-1 w-1 rounded-full"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  background: meta.accent,
                  animationDuration: `${dur}ms`,
                  animationDelay: `${(i * 37) % 900}ms`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ==== BLOOM + LENS FLARE (camera cinematic) ==== */}
      <div
        className="cine-bloom absolute left-1/2 top-1/2"
        style={{
          background: `radial-gradient(circle, ${meta.accent}55 0%, ${meta.from}22 30%, transparent 65%)`,
        }}
      />
      <div className="cine-lensflare absolute left-1/2 top-[38%]" />

      {/* ==== PHASE 7: USER HIGHLIGHT — rarity title ==== */}
      {tier !== "basic" && (
        <div className="pointer-events-none absolute inset-x-0 top-[8vh] flex justify-center">
          <div
            className="cine-title px-5 py-1.5 text-center text-[13px] font-black uppercase tracking-[0.35em]"
            style={{
              background: `linear-gradient(90deg, ${meta.from}, ${meta.accent}, ${meta.to})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: `0 0 30px ${meta.accent}80`,
            }}
          >
            {meta.label}
          </div>
        </div>
      )}

      {/* ==== PHASE 8: COMBO badge ==== */}
      {combo >= 10 && (
        <div className="pointer-events-none absolute right-4 top-[14vh] flex flex-col items-end gap-1">
          <div
            className="cine-combo rounded-full px-3 py-1 text-[13px] font-black text-black shadow-2xl"
            style={{ background: `linear-gradient(90deg, ${meta.from}, ${meta.to})` }}
          >
            COMBO ×{combo === 1314 ? "1314" : combo === 520 ? "520" : combo === 99 ? "99" : "10"}
          </div>
        </div>
      )}
    </div>
  );
}

export default CinematicGiftFX;
