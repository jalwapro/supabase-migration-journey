import { createFileRoute } from '@tanstack/react-router';
import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/lottie-preview')({
  component: LottiePreview,
  head: () => ({ meta: [{ title: 'Lottie Preview' }] }),
});

function LottiePreview() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/lottie/heart-burst.json').then((r) => r.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-black text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Lottie Sample — Heart Burst</h1>
      <p className="text-sm text-white/60">Vector, transparent, loop @ 30fps · ~2KB JSON</p>
      <div className="w-[320px] h-[320px] rounded-2xl bg-black/30 backdrop-blur border border-white/10 flex items-center justify-center">
        {data && <Lottie animationData={data} loop autoplay />}
      </div>
      <p className="text-xs text-white/40 max-w-sm text-center">
        Ye Lottie JSON hai — SVG jaisa sharp, chota size, transparent bg. Pasand aaye to aur gifts (rocket, crown, diamond) isi format me bana dun.
      </p>
    </div>
  );
}
