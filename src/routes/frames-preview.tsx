import { createFileRoute } from "@tanstack/react-router";
import { LevelAvatar } from "@/components/LevelAvatar";

export const Route = createFileRoute("/frames-preview")({
  component: FramesPreview,
  head: () => ({ meta: [{ title: "Jalwa — Animated DP Frames Preview" }] }),
});

const frames = [
  { id: "royal-gold",     name: "Royal Gold Crown",  url: "/animations/frames/royal-gold.svg",     tier: "Legendary" },
  { id: "neon-cyber",     name: "Neon Cyber",        url: "/animations/frames/neon-cyber.svg",     tier: "Epic" },
  { id: "fire-phoenix",   name: "Fire Phoenix",      url: "/animations/frames/fire-phoenix.svg",   tier: "Mythic" },
  { id: "diamond-ice",    name: "Diamond Ice",       url: "/animations/frames/diamond-ice.svg",    tier: "Legendary" },
  { id: "butterfly-dream",name: "Butterfly Dream",   url: "/animations/frames/butterfly-dream.svg",tier: "Epic" },
];

function FramesPreview() {
  return (
    <div className="min-h-screen bg-[#0a0018] text-white p-6">
      <h1 className="text-center text-2xl font-black mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
        Animated DP Frames — Preview
      </h1>
      <p className="text-center text-xs text-white/60 mb-8">
        Ye 5 designs live animated hain. Jo pasand ho batayein — us style ke 20-30 tier variants seed kar denge shop me.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
        {frames.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-white/10 bg-black/40 p-6 flex flex-col items-center gap-3 hover:border-yellow-400/50 transition"
          >
            <div className="mt-4 mb-2">
              <LevelAvatar
                name="Jalwa"
                level={45}
                size="xl"
                frame={f.url}
                showBadge={false}
              />
            </div>
            <div className="text-sm font-bold text-center mt-4">{f.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">{f.tier}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
