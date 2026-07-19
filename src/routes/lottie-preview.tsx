import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const Lottie = lazy(() => import("lottie-react"));

export const Route = createFileRoute("/lottie-preview")({
  component: LottiePreview,
});

const SAMPLES = [
  { name: "Coins", file: "/lottie/coins.json" },
  { name: "Confetti", file: "/lottie/confetti.json" },
  { name: "Diamond", file: "/lottie/diamond.json" },
  { name: "Fire", file: "/lottie/fire.json" },
  { name: "Heart", file: "/lottie/heart.json" },
  { name: "Crown", file: "/lottie/crown.json" },
  { name: "Rocket", file: "/lottie/rocket.json" },
];

function Card({ name, file }: { name: string; file: string }) {
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    fetch(file).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, [file]);
  return (
    <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-center">
      <div className="w-full aspect-square flex items-center justify-center">
        {mounted && data ? (
          <Suspense fallback={<div className="text-white/40 text-sm">…</div>}>
            <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} />
          </Suspense>
        ) : (
          <div className="text-white/40 text-sm">{data === null && mounted ? "not found" : "loading…"}</div>
        )}
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
      </div>
    </div>
  );
}
