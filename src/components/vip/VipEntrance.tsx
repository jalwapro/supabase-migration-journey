import { vipTierForLevel } from "@/lib/vip-levels";
import { VipBadge } from "./VipBadge";

/**
 * Full-width entrance banner shown when a VIP user joins the room.
 * Scales in from the right, holds, and slides out. Tier-colored aura + sparkles.
 */
export function VipEntrance({
  level,
  username,
  avatar,
  onDone,
}: {
  level: number;
  username: string;
  avatar?: string | null;
  onDone?: () => void;
}) {
  const tier = vipTierForLevel(level);
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-24 z-[80] mx-auto flex max-w-[92%] items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur-md"
      style={{
        borderColor: `${tier.color}80`,
        background: `linear-gradient(90deg, ${tier.color}44, rgba(10,4,20,0.85) 60%, transparent)`,
        boxShadow: `0 0 40px -8px ${tier.glow}`,
        animation: "vipEntranceSlide 3.6s ease-in-out forwards",
      }}
      onAnimationEnd={onDone}
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full ring-2"
        style={{ borderColor: tier.color, boxShadow: `0 0 20px ${tier.glow}` }}
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-black text-white">{username.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: tier.color }}>
          {tier.label} has entered
        </p>
        <p className="truncate text-sm font-black text-white">@{username}</p>
      </div>
      <VipBadge level={level} size="sm" />
      {/* sparkles */}
      <span className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full"
            style={{
              left: `${10 + i * 11}%`,
              top: `${20 + (i % 3) * 20}%`,
              background: tier.color,
              boxShadow: `0 0 8px ${tier.color}`,
              animation: `vipSparkle 1.6s ${i * 0.1}s ease-in-out infinite`,
            }}
          />
        ))}
      </span>
      <style>{`
        @keyframes vipEntranceSlide {
          0%   { transform: translateX(120%); opacity: 0; }
          15%  { transform: translateX(0);    opacity: 1; }
          80%  { transform: translateX(0);    opacity: 1; }
          100% { transform: translateX(-120%); opacity: 0; }
        }
        @keyframes vipSparkle { 0%,100%{transform:scale(0.5);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }
      `}</style>
    </div>
  );
}
