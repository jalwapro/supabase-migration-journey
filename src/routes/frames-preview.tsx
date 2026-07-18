import { createFileRoute } from "@tanstack/react-router";
import { LevelAvatar } from "@/components/LevelAvatar";

export const Route = createFileRoute("/frames-preview")({
  component: FramesPreview,
  head: () => ({ meta: [{ title: "Jalwa — Animated DP Frames Preview" }] }),
});

// SVG (code-based) animated frames
const svgFrames = [
  { id: "royal-gold",     name: "Royal Gold Crown",  url: "/animations/frames/royal-gold.svg",     tier: "Legendary" },
  { id: "neon-cyber",     name: "Neon Cyber",        url: "/animations/frames/neon-cyber.svg",     tier: "Epic" },
  { id: "fire-phoenix",   name: "Fire Phoenix",      url: "/animations/frames/fire-phoenix.svg",   tier: "Mythic" },
  { id: "diamond-ice",    name: "Diamond Ice",       url: "/animations/frames/diamond-ice.svg",    tier: "Legendary" },
  { id: "butterfly-dream",name: "Butterfly Dream",   url: "/animations/frames/butterfly-dream.svg",tier: "Epic" },
];

// Premium PNG frames (Behance style — ornate jeweled) with rotating aura + subtle sway
const premiumFrames = [
  { id: "boss-emerald",    name: "Boss Emerald",     url: "/animations/frames/boss-emerald.png",    tier: "Mythic",    aura: "from-emerald-400/60 to-yellow-300/40",  spin: false, sway: true  },
  { id: "royal-elephant",  name: "Royal Elephant",   url: "/animations/frames/royal-elephant.png",  tier: "Legendary", aura: "from-yellow-300/60 to-pink-400/40",     spin: true,  sway: false },
  { id: "lion-ruby",       name: "Lion Ruby",        url: "/animations/frames/lion-ruby.png",       tier: "Mythic",    aura: "from-red-500/60 to-yellow-400/40",      spin: false, sway: true  },
  { id: "sapphire-crown",  name: "Sapphire Crown",   url: "/animations/frames/sapphire-crown.png",  tier: "Legendary", aura: "from-blue-500/60 to-yellow-300/40",     spin: true,  sway: false },
  { id: "oasis-palace",    name: "Oasis Palace",     url: "/animations/frames/oasis-palace.png",    tier: "Epic",      aura: "from-emerald-500/60 to-yellow-300/40",  spin: false, sway: true  },
  { id: "celestial-star",  name: "Celestial Star",   url: "/animations/frames/celestial-star.png",  tier: "Mythic",    aura: "from-indigo-500/60 to-blue-400/40",     spin: true,  sway: false },
];

function PremiumFrameCard({ f }: { f: typeof premiumFrames[number] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/60 to-black/30 p-6 flex flex-col items-center gap-3 hover:border-yellow-400/60 transition group">
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Rotating glow aura */}
        <div className={`absolute inset-[-10%] rounded-full bg-gradient-to-tr ${f.aura} blur-2xl opacity-70 animate-[spin_9s_linear_infinite]`} />
        {/* Pulsing inner glow */}
        <div className={`absolute inset-[10%] rounded-full bg-gradient-to-tr ${f.aura} blur-xl opacity-60 animate-pulse`} />
        {/* Avatar disc */}
        <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/20 bg-gradient-to-br from-pink-500/70 to-purple-600/70 grid place-items-center text-3xl font-black text-white shadow-2xl">
          J
        </div>
        {/* Frame overlay — slow sway or slow rotation for extra life */}
        <img
          src={f.url}
          alt={f.name}
          loading="lazy"
          width={512}
          height={512}
          className={`absolute inset-[-14%] w-[128%] h-[128%] object-contain drop-shadow-[0_8px_24px_rgba(255,215,0,0.35)] ${f.spin ? "animate-[spin_22s_linear_infinite]" : "frame-sway"}`}
          draggable={false}
        />
        {/* Sparkles */}
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          <span className="dp-sparkle dp-sparkle-a" />
          <span className="dp-sparkle dp-sparkle-b" />
          <span className="dp-sparkle dp-sparkle-c" />
          <span className="dp-sparkle dp-sparkle-d" />
        </span>
      </div>
      <div className="text-sm font-bold text-center mt-2">{f.name}</div>
      <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">{f.tier}</div>
    </div>
  );
}

function FramesPreview() {
  return (
    <div className="min-h-screen bg-[#0a0018] text-white p-6">
      <style>{`
        @keyframes frameSway {
          0%,100% { transform: translateY(0) rotate(-1.5deg); }
          50%     { transform: translateY(-3px) rotate(1.5deg); }
        }
        .frame-sway { animation: frameSway 4s ease-in-out infinite; }
      `}</style>

      <h1 className="text-center text-2xl font-black mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
        Premium Animated DP Frames
      </h1>
      <p className="text-center text-xs text-white/60 mb-8">
        Behance style ornate jeweled frames — rotating aura + sway animation. Jo pasand hain batao, shop me seed kar denge.
      </p>

      <h2 className="text-center text-xs uppercase tracking-widest text-yellow-300/80 mt-6 mb-4">✨ Premium Ornate Frames</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {premiumFrames.map((f) => <PremiumFrameCard key={f.id} f={f} />)}
      </div>

      <h2 className="text-center text-xs uppercase tracking-widest text-pink-300/80 mt-12 mb-4">🎨 SVG Animated Frames</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto pb-12">
        {svgFrames.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-white/10 bg-black/40 p-6 flex flex-col items-center gap-3 hover:border-pink-400/50 transition"
          >
            <div className="mt-4 mb-2">
              <LevelAvatar name="Jalwa" level={45} size="xl" frame={f.url} showBadge={false} />
            </div>
            <div className="text-sm font-bold text-center mt-4">{f.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-pink-300/80">{f.tier}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
