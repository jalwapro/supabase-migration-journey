import { createFileRoute } from '@tanstack/react-router';
import crownAsset from '@/assets/gifts/jalwa-royal-crown.mp4.asset.json';
import lamboAsset from '@/assets/gifts/jalwa-lamborghini.mp4.asset.json';
import empireAsset from '@/assets/gifts/jalwa-billionaire-empire.mp4.asset.json';

export const Route = createFileRoute('/gift-preview')({
  component: GiftPreview,
  head: () => ({ meta: [{ title: 'Gift Video Preview' }] }),
});

const clips = [
  { name: '056 · Royal Crown', price: '899', url: crownAsset.url },
  { name: '058 · Lamborghini', price: '1,599', url: lamboAsset.url },
  { name: '075 · Billionaire Empire', price: '99,999', url: empireAsset.url },
];

function GiftPreview() {
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-300 to-pink-500 bg-clip-text text-transparent">
        Jalwa Luxury Gift Videos — Proof Batch
      </h1>
      <p className="text-center text-sm text-white/60 mb-6">
        Quality check. Approve karein toh main baaki 22 videos bhi generate kar dun.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {clips.map((c) => (
          <div key={c.name} className="rounded-2xl overflow-hidden border border-white/10 bg-black">
            <video
              src={c.url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full aspect-[9/16] object-cover"
            />
            <div className="p-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{c.name}</span>
              <span className="text-yellow-400 text-sm">🪙 {c.price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
