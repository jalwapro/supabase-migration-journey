import { ReactNode } from "react";

/**
 * Golden Theatre Card — shared warm brown/gold frame used across
 * Rank, VIP, PK History, Wallet and Games pages.
 * Wraps content in a curtain-lit stage with baroque gold accents.
 */
export function TheatreCard({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-6 pt-2">
      <div
        className="relative overflow-hidden rounded-[28px] border border-[#3a1f0a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{
          background:
            "linear-gradient(180deg,#3d1a05 0%,#5a2a08 22%,#3a1704 50%,#20100a 78%,#180a08 100%)",
        }}
      >
        {/* Curtain rays */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,200,110,0.55)_0%,rgba(180,90,20,0.35)_25%,transparent_60%)]" />
          <div
            className="absolute inset-0 opacity-60 mix-blend-screen"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg,rgba(255,200,120,0.10) 0 2px,transparent 2px 26px)",
            }}
          />
          <div className="absolute left-1/2 top-0 h-[380px] w-[240px] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_0deg,rgba(255,225,160,0.45)_16deg,transparent_34deg,rgba(255,225,160,0.28)_52deg,transparent_74deg)] blur-[1.5px]" />
        </div>

        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export function TheatreDivider({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="mx-auto h-[1px] w-[92%] bg-gradient-to-r from-transparent via-[#ffcf6a]/70 to-transparent" />
      <div className="mx-auto -mt-2 flex w-fit items-center gap-2">
        <span className="text-[#ffcf6a] drop-shadow-[0_0_6px_rgba(255,200,90,0.7)]">◆</span>
        <span className="rounded-full bg-[#2a1204] px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.4em] text-[#ffcf6a]/90 border border-[#ffcf6a]/30">
          {label}
        </span>
        <span className="text-[#ffcf6a] drop-shadow-[0_0_6px_rgba(255,200,90,0.7)]">◆</span>
      </div>
    </div>
  );
}

/** Warm brown gradient row used across list surfaces. */
export function TheatreRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl border border-[#ffcf6a]/15 px-3 py-2.5 ${className}`}
      style={{ background: "linear-gradient(180deg,rgba(60,30,10,0.55),rgba(30,15,8,0.55))" }}
    >
      {children}
    </div>
  );
}

/** Ornate gold avatar ring (matches rank podium). */
export function TheatreAvatarRing({
  src,
  fallback,
  size = 44,
}: {
  src?: string | null;
  fallback: string;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <div
        className="absolute inset-0 rounded-full p-[2px]"
        style={{
          background:
            "conic-gradient(from 210deg,#7a4a10,#ffe8a8,#ffcf6a,#7a4a10,#ffe8a8,#ffcf6a,#7a4a10)",
        }}
      >
        <div className="h-full w-full overflow-hidden rounded-full border border-[#2a1002] bg-[#0a0514]">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm font-black text-white/70">
              {fallback.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Gold coin pill */
export function GoldCoinPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur border border-[#ffcf6a]/25">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[8px] font-black text-[#3a1e00]">
        $
      </span>
      <span className="text-[11px] font-black text-[#ffcf6a]">{children}</span>
    </span>
  );
}

/** Section heading with gold underline */
export function TheatreSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 px-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#ffcf6a]/80">
        {children}
      </p>
      <div className="mt-1 h-[1px] w-16 bg-gradient-to-r from-[#ffcf6a] to-transparent" />
    </div>
  );
}
