import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/gift-preview')({
  component: GiftPreview,
  head: () => ({ meta: [{ title: 'Jalwa Luxury Gifts — Preview' }] }),
});

const clips = [
  { n: '051', name: 'Diamond Watch',          price: '199',    url: '/__l5e/assets-v1/1c99c802-f161-498e-9881-0268e852a053/jalwa-diamond-watch.mp4' },
  { n: '052', name: 'Luxury Perfume',         price: '299',    url: '/__l5e/assets-v1/e9ed36be-cfcc-435d-84cd-7972627eb21e/jalwa-luxury-perfume.mp4' },
  { n: '053', name: 'Gold Bar',               price: '399',    url: '/__l5e/assets-v1/00dfe452-aea9-44d7-9815-48b85459e381/jalwa-gold-bar.mp4' },
  { n: '054', name: 'Diamond Necklace',       price: '499',    url: '/__l5e/assets-v1/e359cd69-2619-4319-b4f9-a40bdccf7f5e/jalwa-diamond-necklace.mp4' },
  { n: '055', name: 'Premium Handbag',        price: '699',    url: '/__l5e/assets-v1/5a4752e5-0adb-4381-8201-3481dc1b1c22/jalwa-premium-handbag.mp4' },
  { n: '056', name: 'Royal Crown',            price: '899',    url: '/__l5e/assets-v1/b27dcc59-4d52-48b8-ab6a-d0f2a2bd9583/jalwa-royal-crown.mp4' },
  { n: '057', name: 'Luxury Sports Car',      price: '1,299',  url: '/__l5e/assets-v1/6232f31a-d029-4646-8eb0-61a36a819b55/jalwa-luxury-sports-car.mp4' },
  { n: '058', name: 'Lamborghini',            price: '1,599',  url: '/__l5e/assets-v1/c7df8a05-f198-41a4-8d2b-997ca27df0ee/jalwa-lamborghini.mp4' },
  { n: '059', name: 'Ferrari',                price: '1,999',  url: '/__l5e/assets-v1/bee37889-94af-47d0-b086-85702b3ad76d/jalwa-ferrari.mp4' },
  { n: '060', name: 'Rolls-Royce Phantom',    price: '2,499',  url: '/__l5e/assets-v1/6cc662b9-1376-4cc1-8882-18f34fafe283/jalwa-rolls-royce-phantom.mp4' },
  { n: '061', name: 'Private Helicopter',     price: '2,999',  url: '/__l5e/assets-v1/556f4370-8f41-432b-a125-48fce3c70578/jalwa-private-helicopter.mp4' },
  { n: '062', name: 'Private Jet',            price: '3,999',  url: '/__l5e/assets-v1/5a3b8396-c5d6-4fbf-ad7f-0cdcd4c657ad/jalwa-private-jet.mp4' },
  { n: '063', name: 'Super Yacht',            price: '4,999',  url: '/__l5e/assets-v1/e41da3f8-5c66-4c18-a455-68d81861941c/jalwa-super-yacht.mp4' },
  { n: '064', name: 'Luxury Villa',           price: '5,999',  url: '/__l5e/assets-v1/f5105812-4e8e-4968-85ba-b1381ea6c015/jalwa-luxury-villa.mp4' },
  { n: '065', name: 'Diamond Safe',           price: '6,999',  url: '/__l5e/assets-v1/b80c7b36-c572-4e1c-830c-597133b0c244/jalwa-diamond-safe.mp4' },
  { n: '066', name: 'Treasure Chest',         price: '7,999',  url: '/__l5e/assets-v1/1e892ec5-062c-48f6-a6a6-f61604d7a578/jalwa-treasure-chest.mp4' },
  { n: '067', name: 'Golden Peacock',         price: '8,999',  url: '/__l5e/assets-v1/96446176-1e22-4239-9f77-8b757b84e18a/jalwa-golden-peacock.mp4' },
  { n: '068', name: 'White Stallion',         price: '9,999',  url: '/__l5e/assets-v1/04816a42-c558-409e-9758-1036e6ed5066/jalwa-white-stallion.mp4' },
  { n: '069', name: 'Crystal Piano',          price: '12,999', url: '/__l5e/assets-v1/5ff94bc1-6d31-40c5-aae7-b2740a1982a2/jalwa-crystal-piano.mp4' },
  { n: '070', name: 'Royal Ballroom',         price: '15,999', url: '/__l5e/assets-v1/2e6c8b06-357e-41f8-88c2-a8e39c4e93e5/jalwa-royal-ballroom.mp4' },
  { n: '071', name: 'Diamond Fountain',       price: '18,999', url: '/__l5e/assets-v1/048feb65-d315-41b8-96d8-e857f4af050b/jalwa-diamond-fountain.mp4' },
  { n: '072', name: 'Golden Palace',          price: '24,999', url: '/__l5e/assets-v1/d6380413-21fe-48d5-b4c6-7fce47051937/jalwa-golden-palace.mp4' },
  { n: '073', name: 'Floating Luxury Island', price: '39,999', url: '/__l5e/assets-v1/c3edd4db-94f8-46b8-90d3-622ade89427a/jalwa-floating-luxury-island.mp4' },
  { n: '074', name: 'Millionaire Mansion',    price: '59,999', url: '/__l5e/assets-v1/5eeb7145-b3bc-4f5d-9b42-6fffec6657f9/jalwa-millionaire-mansion.mp4' },
  { n: '075', name: 'Billionaire Empire',     price: '99,999', url: '/__l5e/assets-v1/39e0fcd9-bef3-4ce1-a0b5-c758f3af125b/jalwa-billionaire-empire.mp4' },
];

type Clip = typeof clips[number];

function GiftPreview() {
  const [active, setActive] = useState<Clip | null>(null);
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-300 to-pink-500 bg-clip-text text-transparent">
        JALWA LUXURY GIFTS (051 – 075)
      </h1>
      <p className="text-center text-xs text-white/60 mb-6">
        Tap any card to play full-screen (smooth playback — one video at a time)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-6xl mx-auto">
        {clips.map((c) => (
          <LazyCard key={c.n} clip={c} onOpen={() => setActive(c)} />
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none px-3 py-1 rounded-full bg-white/10"
            onClick={() => setActive(null)}
            aria-label="Close"
          >
            ×
          </button>
          <video
            src={active.url}
            autoPlay
            loop
            playsInline
            controls
            className="max-h-[90vh] w-auto aspect-[9/16] rounded-2xl shadow-2xl"
          />
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="text-yellow-400 text-xs font-mono">{active.n}</div>
            <div className="text-white text-lg font-bold">{active.name}</div>
            <div className="text-yellow-300">🪙 {active.price}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function LazyCard({ clip, onOpen }: { clip: Clip; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-xl overflow-hidden border border-white/10 bg-black cursor-pointer hover:border-yellow-400/60 transition text-left"
    >
      <div className="w-full aspect-[9/16] bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-black relative flex items-center justify-center">
        <div className="text-4xl">🎁</div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-black text-xl shadow-xl">▶</div>
        </div>
        <div className="absolute top-2 left-2 text-[10px] text-yellow-300/90 font-mono bg-black/40 px-1.5 py-0.5 rounded">
          {clip.n}
        </div>
      </div>
      <div className="p-2">
        <div className="text-xs font-semibold truncate">{clip.name}</div>
        <div className="text-[11px] text-yellow-300">🪙 {clip.price}</div>
      </div>
    </button>
  );
}
