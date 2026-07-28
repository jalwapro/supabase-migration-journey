/**
 * Built-in vector entrance effects. Rendered inline for zero network cost —
 * these are the day-one seed effects (media_url = "builtin:<key>").
 * Admins can upload MP4/WebM/Lottie/SVGA any time; playback path handles all.
 */
import React from "react";

type Ent = React.FC<{ className?: string }>;

const svgFill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

/** Shared animated defs helper */
const Defs = ({ id }: { id: string }) => (
  <defs>
    <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff8d0" stopOpacity="0.9" />
      <stop offset="0.4" stopColor="#f5c542" stopOpacity="0.5" />
      <stop offset="1" stopColor="#f5c542" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#7a5210" />
      <stop offset="0.5" stopColor="#ffe28a" />
      <stop offset="1" stopColor="#7a5210" />
    </linearGradient>
  </defs>
);

const VipGate: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="vg" />
    <circle cx="200" cy="200" r="180" fill="url(#vg-glow)">
      <animate attributeName="r" values="10;220;180" dur="1.6s" fill="freeze" />
    </circle>
    {[-1, 1].map((s) => (
      <rect key={s} x={200 + s * 40 - 20} y="60" width="40" height="280" rx="8" fill="url(#vg-gold)" stroke="#3a2400" strokeWidth="1.5">
        <animate attributeName="x" from={200 - 20} to={200 + s * 40 - 20} dur="1.4s" fill="freeze" />
      </rect>
    ))}
    <text x="200" y="220" textAnchor="middle" fontFamily="Inter" fontSize="80" fontWeight="900" fill="url(#vg-gold)" stroke="#3a2400" strokeWidth="2">
      VIP
      <animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="0.6s" fill="freeze" />
    </text>
  </svg>
);

const RoyalArrival: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="ra" />
    <path d="M 40 340 L 360 340 L 340 380 L 60 380 Z" fill="#8a0f1c">
      <animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze" />
    </path>
    <path d="M 60 300 L 340 300 L 320 340 L 80 340 Z" fill="#c11a30" />
    {Array.from({ length: 12 }).map((_, i) => (
      <ellipse key={i} cx={60 + i * 26} cy="300" rx="6" ry="3" fill="#ffe28a">
        <animate attributeName="cy" values="200;300" begin={`${i * 0.06}s`} dur="0.6s" fill="freeze" />
      </ellipse>
    ))}
    <text x="200" y="180" textAnchor="middle" fontFamily="Georgia,serif" fontSize="52" fontWeight="900" fill="url(#ra-gold)" stroke="#3a2400" strokeWidth="1.5">
      ROYAL
      <animate attributeName="opacity" from="0" to="1" begin="0.8s" dur="0.6s" fill="freeze" />
    </text>
  </svg>
);

const KingThrone: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="kt" />
    <g>
      <animateTransform attributeName="transform" type="translate" from="0 -300" to="0 0" dur="1.2s" fill="freeze" />
      <rect x="130" y="150" width="140" height="180" rx="12" fill="url(#kt-gold)" stroke="#3a2400" strokeWidth="2" />
      <rect x="140" y="170" width="120" height="140" rx="6" fill="#8a0f1c" />
      <path d="M 130 150 L 150 100 L 170 140 L 200 90 L 230 140 L 250 100 L 270 150 Z" fill="url(#kt-gold)" stroke="#3a2400" strokeWidth="2" />
      <circle cx="150" cy="105" r="6" fill="#5cd0ff" />
      <circle cx="200" cy="95" r="8" fill="#ff5555" />
      <circle cx="250" cy="105" r="6" fill="#7cff9a" />
    </g>
    <circle cx="200" cy="240" r="120" fill="url(#kt-glow)" opacity="0.7">
      <animate attributeName="r" values="0;150" begin="1s" dur="0.8s" fill="freeze" />
    </circle>
  </svg>
);

const QueenDiadem: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="qd" />
    <circle cx="200" cy="200" r="160" fill="url(#qd-glow)" opacity="0.6">
      <animate attributeName="r" values="0;180" dur="1.4s" fill="freeze" />
    </circle>
    <g>
      <animateTransform attributeName="transform" type="translate" from="0 -200" to="0 60" dur="1.2s" fill="freeze" />
      <path d="M 130 100 Q 200 20 270 100 L 260 130 Q 200 80 140 130 Z" fill="url(#qd-gold)" stroke="#3a2400" strokeWidth="2" />
      {[160, 200, 240].map((cx, i) => (
        <circle key={i} cx={cx} cy="95" r={i === 1 ? 12 : 8} fill="#7ee8fa" stroke="#0e4d68" strokeWidth="1.5" />
      ))}
    </g>
  </svg>
);

const DiamondBurst: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="db" />
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const x2 = 200 + Math.cos(a) * 200;
      const y2 = 200 + Math.sin(a) * 200;
      return (
        <polygon key={i} points="0,-14 10,0 0,14 -10,0" fill="#e0f7ff" stroke="#0e4d68" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="translate" from="200 200" to={`${x2} ${y2}`} dur="1.2s" fill="freeze" />
          <animate attributeName="opacity" values="1;1;0" dur="1.4s" fill="freeze" />
        </polygon>
      );
    })}
    <circle cx="200" cy="200" r="60" fill="url(#db-glow)">
      <animate attributeName="r" values="0;80" dur="0.6s" fill="freeze" />
    </circle>
  </svg>
);

const GalaxyWarp: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <defs>
      <radialGradient id="gw-bg" cx="0.5" cy="0.5" r="0.7">
        <stop offset="0" stopColor="#4c1d95" />
        <stop offset="1" stopColor="#0a0522" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#gw-bg)" />
    {Array.from({ length: 24 }).map((_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return (
        <line key={i} x1={200 + Math.cos(a) * 30} y1={200 + Math.sin(a) * 30}
              x2={200 + Math.cos(a) * 200} y2={200 + Math.sin(a) * 200}
              stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
          <animate attributeName="stroke-width" values="0.5;3;0.5" dur="1.6s" repeatCount="indefinite" />
        </line>
      );
    })}
    <circle cx="200" cy="200" r="30" fill="#fff">
      <animate attributeName="r" values="0;40;30" dur="1s" fill="freeze" />
    </circle>
  </svg>
);

const FlyingDragon: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="fd" />
    <path d="M 40 300 Q 120 100 200 200 Q 280 300 360 100" stroke="#22c55e" strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.9">
      <animate attributeName="stroke-dasharray" from="0 800" to="800 0" dur="1.8s" fill="freeze" />
    </path>
    <circle cx="360" cy="100" r="18" fill="#facc15" stroke="#3a2400" strokeWidth="2">
      <animate attributeName="opacity" from="0" to="1" begin="1.4s" dur="0.4s" fill="freeze" />
    </circle>
    <circle cx="200" cy="200" r="140" fill="url(#fd-glow)" opacity="0.4" />
  </svg>
);

const PhoenixRebirth: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="pr" />
    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
      <path key={deg}
        d="M 200 380 Q 190 260 200 140 Q 210 260 200 380 Z"
        fill="#ea580c"
        transform={`rotate(${deg} 200 200)`}
        opacity="0.7">
        <animate attributeName="opacity" values="0;1;0.7" begin={`${i * 0.05}s`} dur="1.4s" fill="freeze" />
      </path>
    ))}
    <circle cx="200" cy="200" r="60" fill="url(#pr-glow)">
      <animate attributeName="r" values="0;80" dur="1s" fill="freeze" />
    </circle>
  </svg>
);

const AngelDescend: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="ad" />
    <g>
      <animateTransform attributeName="transform" type="translate" from="0 -200" to="0 0" dur="1.4s" fill="freeze" />
      {[-1, 1].map((s) => (
        <path key={s}
          d={`M ${200 + s * 20} 180 q ${s * 100} -30 ${s * 120} 20 q ${s * -30} 20 ${s * -80} 30 q ${s * 30} -20 ${s * -40} -50 Z`}
          fill="#f5f3ff" stroke="#c9a84c" strokeWidth="1.5" opacity="0.95" />
      ))}
      <circle cx="200" cy="180" r="14" fill="#fff8d0" />
    </g>
    <circle cx="200" cy="200" r="160" fill="url(#ad-glow)" opacity="0.55" />
  </svg>
);

const DemonSummon: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <defs>
      <radialGradient id="ds-bg" cx="0.5" cy="0.5" r="0.7">
        <stop offset="0" stopColor="#4c1d95" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#ds-bg)" />
    <circle cx="200" cy="200" r="140" fill="none" stroke="#c026d3" strokeWidth="3">
      <animate attributeName="stroke-dasharray" from="0 900" to="900 0" dur="1.4s" fill="freeze" />
    </circle>
    <polygon points="200,80 280,320 60,170 340,170 120,320"
             fill="none" stroke="#c026d3" strokeWidth="3">
      <animate attributeName="opacity" from="0" to="1" begin="1s" dur="0.6s" fill="freeze" />
    </polygon>
  </svg>
);

const LightningStorm: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {[80, 160, 240, 320].map((x, i) => (
      <path key={x} d={`M ${x} 40 L ${x - 20} 180 L ${x + 10} 190 L ${x - 15} 360`}
            stroke="#facc15" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.95">
        <animate attributeName="opacity" values="0;1;0;1" begin={`${i * 0.1}s`} dur="1.2s" fill="freeze" />
      </path>
    ))}
    <rect width="400" height="400" fill="#fef9c3" opacity="0">
      <animate attributeName="opacity" values="0;0.6;0" dur="0.3s" repeatCount="3" />
    </rect>
  </svg>
);

const SpacePortal: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {[160, 120, 80, 40].map((r, i) => (
      <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#7dd3fc" strokeWidth={3 - i * 0.4} opacity={0.8 - i * 0.15}>
        <animate attributeName="r" values={`0;${r}`} begin={`${i * 0.15}s`} dur="1.2s" fill="freeze" />
      </circle>
    ))}
    <circle cx="200" cy="200" r="30" fill="#a78bfa">
      <animate attributeName="r" values="0;30" begin="0.8s" dur="0.6s" fill="freeze" />
    </circle>
  </svg>
);

const FireGate: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {[-1, 1].map((s) => (
      <path key={s} d={`M ${200 + s * 20} 380 q ${s * 40} -100 ${s * 20} -200 q ${s * -30} 60 ${s * 10} 200 Z`}
            fill="#ea580c" opacity="0.9">
        <animate attributeName="transform" attributeType="XML" type="translate"
          values={`0 0; ${s * 40} 0`} dur="1.6s" fill="freeze" />
      </path>
    ))}
    <circle cx="200" cy="200" r="120" fill="#facc15" opacity="0.3">
      <animate attributeName="r" values="0;120" dur="1s" fill="freeze" />
    </circle>
  </svg>
);

const IceShatter: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <polygon key={i} points="0,-50 15,0 0,50 -15,0" fill="#c7ecff" stroke="#0e4d68" strokeWidth="1.5"
                 transform={`translate(200 200) rotate(${(a * 180) / Math.PI})`}>
          <animateTransform attributeName="transform" type="translate"
            from={`200 200`} to={`${200 + Math.cos(a) * 150} ${200 + Math.sin(a) * 150}`} dur="1.2s" fill="freeze" />
        </polygon>
      );
    })}
  </svg>
);

const LuxuryGold: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="lg" />
    {[-1, 1].map((s) => (
      <g key={s}>
        <animateTransform attributeName="transform" type="translate"
          from="0 0" to={`${s * 100} 0`} dur="1.4s" fill="freeze" />
        <rect x={200 + s * 20 - (s > 0 ? 0 : 100)} y="40" width="100" height="320"
              fill="url(#lg-gold)" stroke="#3a2400" strokeWidth="2" />
        {[80, 140, 200, 260, 320].map((y) => (
          <circle key={y} cx={200 + s * 20 + (s > 0 ? 50 : -50)} cy={y} r="6" fill="#8a0f1c" stroke="#3a2400" strokeWidth="1" />
        ))}
      </g>
    ))}
    <circle cx="200" cy="200" r="120" fill="url(#lg-glow)" opacity="0.5" />
  </svg>
);

const NeonCyber: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <rect width="400" height="400" fill="#050518" />
    {Array.from({ length: 10 }).map((_, i) => (
      <line key={`h${i}`} x1="0" y1={i * 40 + 20} x2="400" y2={i * 40 + 20} stroke="#22d3ee" strokeWidth="0.8" opacity="0.6" />
    ))}
    {Array.from({ length: 10 }).map((_, i) => (
      <line key={`v${i}`} x1={i * 40 + 20} y1="0" x2={i * 40 + 20} y2="400" stroke="#22d3ee" strokeWidth="0.8" opacity="0.6" />
    ))}
    <text x="200" y="220" textAnchor="middle" fontFamily="ui-monospace" fontSize="72" fontWeight="900" fill="#22d3ee">
      NEON
      <animate attributeName="opacity" values="0;1;0.5;1" dur="1.4s" fill="freeze" />
    </text>
  </svg>
);

const FutureTech: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <circle cx="200" cy="200" r="140" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 6">
      <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="6s" repeatCount="indefinite" />
    </circle>
    <circle cx="200" cy="200" r="100" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.7">
      <animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="5s" repeatCount="indefinite" />
    </circle>
    <circle cx="200" cy="200" r="60" fill="none" stroke="#22d3ee" strokeWidth="2" />
    <text x="200" y="210" textAnchor="middle" fontFamily="ui-monospace" fontSize="24" fill="#22d3ee">HUD</text>
  </svg>
);

const FestivalBurst: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {Array.from({ length: 40 }).map((_, i) => {
      const a = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 60;
      const color = ["#f472b6", "#22d3ee", "#facc15", "#a78bfa"][i % 4];
      return (
        <circle key={i} cx="200" cy="200" r="4" fill={color}>
          <animate attributeName="cx" from="200" to={200 + Math.cos(a) * r} dur="1.4s" fill="freeze" />
          <animate attributeName="cy" from="200" to={200 + Math.sin(a) * r} dur="1.4s" fill="freeze" />
          <animate attributeName="opacity" values="1;0" dur="1.6s" fill="freeze" />
        </circle>
      );
    })}
  </svg>
);

const RomanticPetals: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    {Array.from({ length: 24 }).map((_, i) => (
      <ellipse key={i} cx={Math.random() * 400} cy={-20} rx="7" ry="4" fill="#f472b6" opacity="0.85"
               transform={`rotate(${Math.random() * 360})`}>
        <animate attributeName="cy" from="-20" to="420" begin={`${Math.random() * 1.2}s`} dur={`${2 + Math.random()}s`} fill="freeze" />
      </ellipse>
    ))}
    <circle cx="200" cy="200" r="120" fill="#f472b6" opacity="0.15" />
  </svg>
);

const JalwaExclusive: Ent = () => (
  <svg viewBox="0 0 400 400" style={svgFill}>
    <Defs id="je" />
    <circle cx="200" cy="200" r="180" fill="url(#je-glow)">
      <animate attributeName="r" values="0;220;180" dur="1.6s" fill="freeze" />
    </circle>
    {Array.from({ length: 16 }).map((_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return (
        <line key={i} x1={200 + Math.cos(a) * 80} y1={200 + Math.sin(a) * 80}
              x2={200 + Math.cos(a) * 190} y2={200 + Math.sin(a) * 190}
              stroke="url(#je-gold)" strokeWidth="3" strokeLinecap="round" />
      );
    })}
    <text x="200" y="215" textAnchor="middle" fontFamily="Georgia,serif" fontSize="48" fontWeight="900"
          fill="url(#je-gold)" stroke="#3a2400" strokeWidth="1.5" letterSpacing="4">
      JALWA
      <animate attributeName="opacity" from="0" to="1" begin="1s" dur="0.6s" fill="freeze" />
    </text>
  </svg>
);

export const BUILTIN_ENTRANCES: Record<string, Ent> = {
  vip_gate: VipGate,
  royal_arrival: RoyalArrival,
  king_throne: KingThrone,
  queen_diadem: QueenDiadem,
  diamond_burst: DiamondBurst,
  galaxy_warp: GalaxyWarp,
  flying_dragon: FlyingDragon,
  phoenix_rebirth: PhoenixRebirth,
  angel_descend: AngelDescend,
  demon_summon: DemonSummon,
  lightning_storm: LightningStorm,
  space_portal: SpacePortal,
  fire_gate: FireGate,
  ice_shatter: IceShatter,
  luxury_gold: LuxuryGold,
  neon_cyber: NeonCyber,
  future_tech: FutureTech,
  festival_burst: FestivalBurst,
  romantic_petals: RomanticPetals,
  jalwa_exclusive: JalwaExclusive,
};

export function BuiltinEntranceView({ mediaUrl, className }: { mediaUrl: string; className?: string }) {
  const key = mediaUrl.replace(/^builtin:/, "");
  const Cmp = BUILTIN_ENTRANCES[key];
  if (!Cmp) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
      <Cmp />
    </div>
  );
}

export const ENTRANCE_CATEGORIES = [
  "VIP", "Royal", "King", "Queen", "Diamond", "Galaxy",
  "Dragon", "Phoenix", "Angel", "Demon", "Lightning", "Space",
  "Fire", "Ice", "Luxury", "Neon", "FutureTech", "Festival",
  "Romantic", "Legendary",
] as const;
