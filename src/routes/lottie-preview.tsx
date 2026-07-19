import { createFileRoute } from "@tanstack/react-router";
import Lottie from "lottie-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/lottie-preview")({
  component: LottiePreview,
});

const SAMPLES = [
  { name: "Rocket", file: "/lottie/rocket.json" },
  { name: "Coins", file: "/lottie/coins.json" },
  { name: "Confetti", file: "/lottie/confetti.json" },
  { name: "Diamond", file: "/lottie/diamond.json" },
  { name: "Fire", file: "/lottie/fire.json" },
  { name: "Heart", file: "/lottie/heart.json" },
  { name: "Crown", file: "/lottie/crown.json" },
];

function Card({ name, file }: { name: string; file: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(file).then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [file]);
  return (
    <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-center">
      <div className="w-full aspect-square flex items-center justify-center">
        {data ? <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} /> : <div className="text-white/40 text-sm">loading…</div>}
      </div>
      <div className="text-white font-semibold mt-2">{name}</div>
    </div>
  );
}

function LottiePreview() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-black p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Lottie Samples</h1>
        <p className="text-white/60 text-center mb-6">Real vector animations — transparent, smooth, looping</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {SAMPLES.map((s) => <Card key={s.file} {...s} />)}
        </div>
        <p className="text-white/50 text-center text-sm mt-6">
          Pasand aaye to inhe gifts / shop me add kar dunga. Ya specific style batao (car, jet, ring, dragon) — Lottie me bana ke ya library se laa ke dikhata hoon.
        </p>
      </div>
    </div>
  );
}
