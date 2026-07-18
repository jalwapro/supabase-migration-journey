import { createFileRoute } from '@tanstack/react-router';
import SvgaPlayer from '@/components/room/SvgaPlayer';

export const Route = createFileRoute('/svga-frames-preview')({
  component: Page,
  head: () => ({ meta: [{ title: 'SVGA DP Frames — Preview' }] }),
});

const frames = [
  { name: 'Angel Wings',  file: '/animations/frames/svga/angel.svga',       tier: 'Mythic' },
  { name: 'King Set',     file: '/animations/frames/svga/kingset.svga',     tier: 'Legendary' },
  { name: 'Rose Bloom',   file: '/animations/frames/svga/rose.svga',        tier: 'Epic' },
  { name: 'Halloween',    file: '/animations/frames/svga/halloween.svga',   tier: 'Epic' },
  { name: 'Matte Glow',   file: '/animations/frames/svga/matteBitmap.svga', tier: 'Rare' },
];

function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-center mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          🖼️ SVGA Animated DP Frames — Live Test
        </h1>
        <p className="text-center text-xs text-white/60 mb-6">
          Real SVGA files overlaid on avatar. Transparent, ~70–300 KB each, buttery smooth.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {frames.map((f) => (
            <div key={f.file} className="rounded-2xl border border-white/10 bg-black/40 p-4 flex flex-col items-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Avatar */}
                <div className="absolute inset-[22%] rounded-full overflow-hidden ring-2 ring-white/20 bg-gradient-to-br from-pink-500/70 to-purple-600/70 grid place-items-center text-3xl font-black text-white shadow-2xl">
                  J
                </div>
                {/* SVGA frame overlay */}
                <SvgaPlayer
                  src={f.file}
                  className="absolute inset-0"
                  style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                />
              </div>
              <div className="mt-3 text-sm font-bold">{f.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">{f.tier}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/50 mt-8">
          Note: Ye samples gift-style hain (SVGA-Samples repo se). Real DP frames ke liye Fiverr designer se custom .svga banwana padega (~$15–30/frame).
        </p>
      </div>
    </div>
  );
}
