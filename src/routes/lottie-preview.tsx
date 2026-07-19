import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
  const container = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let anim: any;
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import("lottie-web/build/player/lottie_light.js");
        const lottie = mod.default ?? mod;
        const res = await fetch(file);
        if (!res.ok) throw new Error("404");
        const data = await res.json();
        if (cancelled || !container.current) return;
        anim = lottie.loadAnimation({
          container: container.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        setLoaded(true);
      } catch (e: any) {
        setErr(e.message || "failed");
      }
    })();
    return () => {
      cancelled = true;
      anim?.destroy?.();
    };
  }, [file]);

  return (
    <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-center">
      <div ref={container} className="w-full aspect-square flex items-center justify-center">
        {!loaded && <div className="text-white/40 text-sm">{err ?? "loading…"}</div>}
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
