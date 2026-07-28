/**
 * Pure-SVG animated backgrounds for the 45 seed profile cards.
 * Every design is <2KB rendered, GPU-accelerated, respects reduced motion.
 * The `bg_media_url` field in `profile_cards` stores a `builtin:<key>` id.
 */
import { memo } from "react";

type Props = { className?: string };

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function Layer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`absolute inset-0 overflow-hidden ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------
// Basic (4)
// ---------------------------------------------------------------
const Classic = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
    <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
  </Layer>
));
const Elegant = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#2b1a3d] via-[#1a0f2e] to-[#0a0512]" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_30%,rgba(249,215,161,0.15)_50%,transparent_70%)] animate-[shimmer_6s_linear_infinite] [background-size:200%_100%]" />
  </Layer>
));
const DarkMode = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.35),transparent_60%)]" />
  </Layer>
));
const Minimal = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-900" />
  </Layer>
));

// ---------------------------------------------------------------
// VIP (4)
// ---------------------------------------------------------------
const VipGold = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#3a2408] via-[#1a0f04] to-black" />
    <div className="absolute inset-0 opacity-70 [background:conic-gradient(from_0deg,rgba(255,215,106,0.35),transparent_30%,rgba(255,215,106,0.35)_60%,transparent_90%)] animate-[spin_18s_linear_infinite]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_120%,rgba(255,215,106,0.4),transparent_60%)]" />
  </Layer>
));
const VipPlatinum = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-slate-500 via-slate-700 to-slate-900" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_30%,rgba(226,232,240,0.4)_50%,transparent_70%)] animate-[shimmer_5s_linear_infinite] [background-size:200%_100%]" />
  </Layer>
));
const VipDiamond = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#083344] via-[#0c4a6e] to-[#020617]" />
    <div className="absolute inset-0 opacity-70 [background:conic-gradient(from_45deg,rgba(165,243,252,0.5),transparent_30%,rgba(34,211,238,0.5)_60%,transparent_90%)] animate-[spin_14s_linear_infinite]" />
    <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="diaPat" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="rgba(165,243,252,0.4)" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#diaPat)" />
    </svg>
  </Layer>
));
const VipBlack = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:conic-gradient(from_90deg,rgba(255,215,106,0.6),transparent_25%,rgba(255,215,106,0.6)_50%,transparent_75%,rgba(255,215,106,0.6))] animate-[spin_20s_linear_infinite] opacity-40" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_50%,transparent_30%,black_70%)]" />
  </Layer>
));

// ---------------------------------------------------------------
// Royal (5)
// ---------------------------------------------------------------
const King = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#450a0a] via-[#7f1d1d] to-[#1a0505]" />
    <div className="absolute inset-0 opacity-40 [background:radial-gradient(ellipse_at_top,rgba(255,215,106,0.5),transparent_60%)]" />
    <Embers />
  </Layer>
));
const Queen = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#3b0764] via-[#581c87] to-[#1e0538]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_20%_80%,rgba(240,171,252,0.35),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(217,70,239,0.35),transparent_50%)]" />
  </Layer>
));
const Emperor = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#78350f] via-[#451a03] to-black" />
    <div className="absolute inset-0 opacity-70 [background:conic-gradient(from_0deg,rgba(255,215,106,0.4),transparent_20%,rgba(255,215,106,0.4)_40%,transparent_60%,rgba(255,215,106,0.4)_80%,transparent)] animate-[spin_25s_linear_infinite]" />
    <Embers />
  </Layer>
));
const Empress = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#500724] via-[#831843] to-[#1a0510]" />
    <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_50%_0%,rgba(251,207,232,0.5),transparent_60%)]" />
    <Petals />
  </Layer>
));
const RoyalPalace = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#0a0620]" />
    <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 400 200" preserveAspectRatio="none">
      {[40, 100, 160, 240, 300, 360].map((x) => (
        <rect key={x} x={x} y={40} width={22} height={140} fill="url(#col)" />
      ))}
      <defs>
        <linearGradient id="col" x1="0" x2="1">
          <stop offset="0" stopColor="#ffd76a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffd76a" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_120%,rgba(255,215,106,0.4),transparent_60%)]" />
  </Layer>
));

// ---------------------------------------------------------------
// Luxury (5)
// ---------------------------------------------------------------
const LuxGold = memo(() => (
  <Layer>
    <div className="absolute inset-0 [background:linear-gradient(135deg,#f59e0b_0%,#ffd76a_35%,#78350f_100%)]" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.5)_50%,transparent_70%)] animate-[shimmer_4s_linear_infinite] [background-size:200%_100%]" />
  </Layer>
));
const LuxBlackGold = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#171717] to-black" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_35%,rgba(255,215,106,0.55)_50%,transparent_65%)] animate-[shimmer_5s_linear_infinite] [background-size:200%_100%]" />
    <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="bgPat" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#ffd76a" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#bgPat)" />
    </svg>
  </Layer>
));
const LuxRose = memo(() => (
  <Layer>
    <div className="absolute inset-0 [background:linear-gradient(135deg,#f9a8d4,#be185d_60%,#4a044e)]" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.4)_50%,transparent_70%)] animate-[shimmer_6s_linear_infinite] [background-size:200%_100%]" />
    <Petals />
  </Layer>
));
const LuxCrystal = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#083344] via-[#155e75] to-black" />
    <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cryG" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a5f3fc" stopOpacity="0.7" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {[[10,20],[30,60],[55,15],[70,70],[85,40]].map(([x,y],i)=>(
        <polygon key={i} points={`${x},${y-8} ${x+6},${y} ${x},${y+8} ${x-6},${y}`} fill="url(#cryG)" />
      ))}
    </svg>
  </Layer>
));
const LuxPlat = memo(() => (
  <Layer>
    <div className="absolute inset-0 [background:linear-gradient(135deg,#e2e8f0,#94a3b8_50%,#1e293b)]" />
    <div className="absolute inset-0 [background:linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.6)_50%,transparent_70%)] animate-[shimmer_4s_linear_infinite] [background-size:200%_100%]" />
  </Layer>
));

// ---------------------------------------------------------------
// Fantasy (5)
// ---------------------------------------------------------------
const Dragon = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#450a0a] via-[#7c2d12] to-[#0c0403]" />
    <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="scale" width="12" height="10" patternUnits="userSpaceOnUse">
          <path d="M6 0 C0 5 0 10 6 10 C12 10 12 5 6 0 Z" fill="none" stroke="#f97316" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#scale)" />
    </svg>
    <Embers />
  </Layer>
));
const Phoenix = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-t from-[#7f1d1d] via-[#dc2626] to-[#fbbf24]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.7),transparent_50%)]" />
    <Embers dense />
  </Layer>
));
const Angel = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#fef3c7] via-[#fde68a] to-[#f0abfc]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.85),transparent_50%)]" />
    <Sparkles />
  </Layer>
));
const Demon = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#7f1d1d] to-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_30%_30%,rgba(239,68,68,0.6),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(220,38,38,0.5),transparent_50%)]" />
    <Embers />
  </Layer>
));
const Unicorn = memo(() => (
  <Layer>
    <div className="absolute inset-0 [background:linear-gradient(135deg,#f0abfc,#a5f3fc_35%,#fef3c7_65%,#f9a8d4)]" />
    <div className="absolute inset-0 opacity-60 [background:conic-gradient(from_0deg,#f0abfc,#22d3ee,#fef3c7,#f9a8d4,#f0abfc)] mix-blend-overlay animate-[spin_30s_linear_infinite]" />
    <Sparkles />
  </Layer>
));

// ---------------------------------------------------------------
// Galaxy (5)
// ---------------------------------------------------------------
const Galaxy = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,rgba(167,139,250,0.5),transparent_50%),radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.4),transparent_40%)]" />
    <Stars />
  </Layer>
));
const Nebula = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_30%_40%,rgba(240,171,252,0.6),transparent_45%),radial-gradient(circle_at_70%_60%,rgba(124,58,237,0.6),transparent_45%)]" />
    <Stars />
  </Layer>
));
const Portal = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:conic-gradient(from_0deg,rgba(34,211,238,0.5),rgba(124,58,237,0.5),rgba(34,211,238,0.5))] animate-[spin_12s_linear_infinite]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_50%,transparent_25%,black_65%)]" />
    <Stars />
  </Layer>
));
const Cosmic = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0f172a] to-black" />
    <div className="absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(34,211,238,0.5),transparent_30%,rgba(240,171,252,0.5)_60%,transparent)] animate-[shimmer_8s_linear_infinite] [background-size:200%_100%]" />
    <Sparkles />
  </Layer>
));
const BlackHole = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 [background:conic-gradient(from_0deg,rgba(245,158,11,0.6),transparent_30%,rgba(245,158,11,0.6)_70%,transparent)] animate-[spin_8s_linear_infinite]" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_50%,black_15%,transparent_60%)]" />
    <Stars />
  </Layer>
));

// ---------------------------------------------------------------
// Nature (5)
// ---------------------------------------------------------------
const Sakura = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#831843] via-[#be185d] to-[#fbcfe8]" />
    <Petals dense />
  </Layer>
));
const Ocean = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#0369a1] via-[#0c4a6e] to-black" />
    <Bubbles />
  </Layer>
));
const Forest = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#052e16] via-[#166534] to-[#022c22]" />
    <div className="absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(134,239,172,0.35),transparent_50%)]" />
    <Sparkles />
  </Layer>
));
const Ice = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#bae6fd] via-[#0284c7] to-[#0c4a6e]" />
    <Snow />
  </Layer>
));
const Fire = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-t from-[#7f1d1d] via-[#b91c1c] to-[#fbbf24]" />
    <Embers dense />
  </Layer>
));

// ---------------------------------------------------------------
// Neon (5)
// ---------------------------------------------------------------
const NeonBlue = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <NeonGrid color="#38bdf8" />
  </Layer>
));
const NeonPurple = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <NeonGrid color="#c084fc" />
  </Layer>
));
const Cyberpunk = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#1e0538] via-black to-[#0c0a09]" />
    <NeonGrid color="#f0abfc" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.4),transparent_50%)]" />
  </Layer>
));
const FutureCity = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-black" />
    <svg className="absolute inset-x-0 bottom-0 w-full opacity-80" viewBox="0 0 400 120" preserveAspectRatio="none">
      {[...Array(14)].map((_, i) => {
        const x = i * 30;
        const h = 40 + ((i * 37) % 70);
        return <rect key={i} x={x} y={120 - h} width={22} height={h} fill="#22d3ee" opacity="0.4" />;
      })}
    </svg>
    <Stars />
  </Layer>
));
const Matrix = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-black" />
    <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[...Array(20)].map((_, i) => (
        <text
          key={i}
          x={i * 5 + 1}
          y={((i * 13) % 100)}
          fontSize="4"
          fill="#22c55e"
          className="[animation:fall_var(--d)_linear_infinite]"
          style={{ ["--d" as any]: `${3 + (i % 5)}s`, transform: `translateY(${i * 6}px)` }}
        >
          01101001
        </text>
      ))}
    </svg>
  </Layer>
));

// ---------------------------------------------------------------
// Event (7)
// ---------------------------------------------------------------
const Ramadan = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-black" />
    <svg className="absolute right-6 top-8 h-16 w-16" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="#ffd76a" />
      <circle cx="26" cy="17" r="14" fill="#1e1b4b" />
    </svg>
    <Sparkles />
  </Layer>
));
const Eid = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#166534] via-[#065f46] to-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_20%,rgba(255,215,106,0.5),transparent_50%)]" />
    <Sparkles />
  </Layer>
));
const Independence = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#166534] via-[#052e16] to-black" />
    <svg className="absolute right-4 top-4 h-14 w-14" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="12" fill="#fef3c7" />
      <circle cx="24" cy="18" r="12" fill="#166534" />
      <polygon points="16,17 17,20 20,20 17.5,22 18.5,25 16,23 13.5,25 14.5,22 12,20 15,20" fill="#fef3c7" />
    </svg>
  </Layer>
));
const Halloween = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#7c2d12] via-[#431407] to-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_120%,rgba(249,115,22,0.6),transparent_50%)]" />
    <Embers />
  </Layer>
));
const Christmas = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#166534] via-[#14532d] to-[#450a0a]" />
    <Snow />
  </Layer>
));
const NewYear = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-black to-black" />
    <div className="absolute inset-0 [background:radial-gradient(circle_at_30%_30%,rgba(255,215,106,0.6),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(240,171,252,0.6),transparent_25%),radial-gradient(circle_at_50%_75%,rgba(34,211,238,0.6),transparent_25%)]" />
    <Sparkles dense />
  </Layer>
));
const Valentine = memo(() => (
  <Layer>
    <div className="absolute inset-0 bg-gradient-to-br from-[#be185d] via-[#f472b6] to-[#500724]" />
    <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[[15,20],[80,25],[30,60],[75,70],[50,85]].map(([x,y],i)=>(
        <path key={i} d={`M ${x},${y+2} C ${x-4},${y-3} ${x-8},${y+3} ${x},${y+8} C ${x+8},${y+3} ${x+4},${y-3} ${x},${y+2} Z`} fill="#fef3c7" opacity="0.7" />
      ))}
    </svg>
    <Petals />
  </Layer>
));

// ---------------------------------------------------------------
// Particle overlays
// ---------------------------------------------------------------
function Sparkles({ dense = false }: { dense?: boolean }) {
  const n = dense ? 24 : 12;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[...Array(n)].map((_, i) => {
        const x = ((i * 37) % 100);
        const y = ((i * 53) % 100);
        const d = 2 + (i % 4);
        return (
          <circle
            key={i}
            cx={x} cy={y} r={0.6 + (i % 3) * 0.4}
            fill="white"
            className="[animation:twinkle_var(--d)_ease-in-out_infinite]"
            style={{ ["--d" as any]: `${d}s`, animationDelay: `${(i % 5) * 0.3}s` }}
          />
        );
      })}
    </svg>
  );
}
function Stars() { return <Sparkles dense />; }
function Embers({ dense = false }: { dense?: boolean }) {
  const n = dense ? 18 : 10;
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...Array(n)].map((_, i) => (
        <span
          key={i}
          className="absolute block h-1.5 w-1.5 rounded-full bg-amber-400 [animation:rise_var(--d)_linear_infinite]"
          style={{
            left: `${(i * 41) % 100}%`,
            bottom: "-10%",
            ["--d" as any]: `${4 + (i % 5)}s`,
            animationDelay: `${(i % 6) * 0.4}s`,
            boxShadow: "0 0 6px 1px rgba(251,146,60,0.7)",
          }}
        />
      ))}
    </div>
  );
}
function Petals({ dense = false }: { dense?: boolean }) {
  const n = dense ? 18 : 10;
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...Array(n)].map((_, i) => (
        <span
          key={i}
          className="absolute block h-2 w-3 rounded-[50%] bg-pink-200/80 [animation:fall_var(--d)_linear_infinite]"
          style={{
            left: `${(i * 43) % 100}%`,
            top: "-10%",
            ["--d" as any]: `${6 + (i % 5)}s`,
            animationDelay: `${(i % 6) * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}
function Snow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...Array(20)].map((_, i) => (
        <span
          key={i}
          className="absolute block h-1.5 w-1.5 rounded-full bg-white/90 [animation:fall_var(--d)_linear_infinite]"
          style={{
            left: `${(i * 29) % 100}%`,
            top: "-10%",
            ["--d" as any]: `${5 + (i % 6)}s`,
            animationDelay: `${(i % 5) * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}
function Bubbles() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...Array(14)].map((_, i) => (
        <span
          key={i}
          className="absolute block rounded-full border border-cyan-200/60 bg-cyan-200/20 [animation:rise_var(--d)_linear_infinite]"
          style={{
            left: `${(i * 37) % 100}%`,
            bottom: "-10%",
            width: `${4 + (i % 4) * 3}px`,
            height: `${4 + (i % 4) * 3}px`,
            ["--d" as any]: `${5 + (i % 5)}s`,
            animationDelay: `${(i % 6) * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}
function NeonGrid({ color }: { color: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id={`grid-${color}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke={color} strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#grid-${color})`} />
    </svg>
  );
}

// ---------------------------------------------------------------
// Registry
// ---------------------------------------------------------------
const REGISTRY: Record<string, React.FC<Props>> = {
  classic: Classic, elegant: Elegant, dark: DarkMode, minimal: Minimal,
  vip_gold: VipGold, vip_plat: VipPlatinum, vip_diamond: VipDiamond, vip_black: VipBlack,
  king: King, queen: Queen, emperor: Emperor, empress: Empress, royal_palace: RoyalPalace,
  lux_gold: LuxGold, lux_bg: LuxBlackGold, lux_rose: LuxRose, lux_crystal: LuxCrystal, lux_plat: LuxPlat,
  dragon: Dragon, phoenix: Phoenix, angel: Angel, demon: Demon, unicorn: Unicorn,
  galaxy: Galaxy, nebula: Nebula, portal: Portal, cosmic: Cosmic, blackhole: BlackHole,
  sakura: Sakura, ocean: Ocean, forest: Forest, ice: Ice, fire: Fire,
  neon_blue: NeonBlue, neon_purple: NeonPurple, cyberpunk: Cyberpunk, future_city: FutureCity, matrix: Matrix,
  ramadan: Ramadan, eid: Eid, independence: Independence, halloween: Halloween,
  christmas: Christmas, new_year: NewYear, valentine: Valentine,
};

export function BuiltinProfileCardBg({ mediaUrl, className }: { mediaUrl: string; className?: string }) {
  const key = mediaUrl.replace(/^builtin:/, "");
  const Comp = REGISTRY[key] ?? Classic;
  return <Comp className={className} />;
}

export function hasBuiltinProfileCard(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return false;
  if (!mediaUrl.startsWith("builtin:")) return false;
  return !!REGISTRY[mediaUrl.replace(/^builtin:/, "")];
}
