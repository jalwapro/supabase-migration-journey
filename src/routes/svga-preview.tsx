import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import SvgaPlayer from '@/components/room/SvgaPlayer';

export const Route = createFileRoute('/svga-preview')({
  component: SvgaPreview,
  head: () => ({ meta: [{ title: 'SVGA Gifts — Preview' }] }),
});

const gifts = [
  { name: 'Royal Crown', file: '/animations/gifts/svga/kingset.svga',   price: 999,  emoji: '👑' },
  { name: 'Ferrari',     file: '/animations/gifts/svga/ferrari.svga',   price: 1999, emoji: '🏎️' },
  { name: 'Heartbeat',   file: '/animations/gifts/svga/heartbeat.svga', price: 199,  emoji: '💗' },
  { name: 'Rose',        file: '/animations/gifts/svga/rose.svga',      price: 149,  emoji: '🌹' },
  { name: 'Gift Box',    file: '/animations/gifts/svga/giftbox.svga',   price: 99,   emoji: '🎁' },
  { name: 'Angel',       file: '/animations/gifts/svga/angel.svga',     price: 299,  emoji: '👼' },
  { name: 'Halloween',   file: '/animations/gifts/svga/halloween.svga', price: 199,  emoji: '🎃' },
  { name: 'Rocket',      file: '/animations/gifts/svga/Rocket.svga',    price: 399,  emoji: '🚀' },
];

function SvgaPreview() {
  const [active, setActive] = useState<(typeof gifts)[number] | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-black text-white p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-300 to-pink-500 bg-clip-text text-transparent">
          🎁 SVGA Gifts — Live Preview
        </h1>
        <p className="text-center text-xs text-white/60 mb-6">
          TikTok/Bigo-style animated gifts. True transparency, tiny file size (~5-170 KB).
          <br/>Tap any gift to play full-screen.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {gifts.map((g) => (
            <button
              key={g.file}
              onClick={() => setActive(g)}
              className="rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-yellow-400/60 transition p-2 flex flex-col items-center"
            >
              <div className="w-full aspect-square bg-gradient-to-br from-purple-900/40 to-black rounded-lg overflow-hidden flex items-center justify-center">
                <SvgaPlayer
                  src={g.file}
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="mt-2 text-sm font-semibold">{g.emoji} {g.name}</div>
              <div className="text-xs text-yellow-300">🪙 {g.price}</div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-xs text-white/50 text-center space-y-1">
          <p>✨ SVGA = official format used by TikTok, Bigo, Likee, Poppo</p>
          <p>💡 Files above are open-source samples from github.com/svga/SVGA-Samples</p>
          <p>🎨 For custom SVGA gifts: hire designer on Fiverr (~$15-30/gift) — drop files in <code>public/animations/gifts/svga/</code></p>
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl px-3 py-1 rounded-full bg-white/10"
            onClick={() => setActive(null)}
          >
            ×
          </button>
          <SvgaPlayer
            src={active.file}
            className="max-h-[85vh] max-w-full"
            style={{ width: 480, height: 720 }}
          />
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="text-white text-xl font-bold">{active.emoji} {active.name}</div>
            <div className="text-yellow-300">🪙 {active.price}</div>
          </div>
        </div>
      )}
    </div>
  );
}
