import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

const GIFTS = [
  { e: "🌹", n: "Rose", p: "10" },
  { e: "💎", n: "Diamond", p: "100" },
  { e: "🎂", n: "Cake", p: "200" },
  { e: "🐎", n: "Horse", p: "5K" },
  { e: "💃", n: "Couple", p: "50K" },
  { e: "🚀", n: "Rocket", p: "10K" },
  { e: "👑", n: "Crown", p: "20K" },
  { e: "🦁", n: "Lion", p: "80K" },
  { e: "🏰", n: "Castle", p: "100K" },
];

export const SceneGifting = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);

  // big gift flying in
  const giftSp = springIn(frame, fps, 40, 10);
  const giftScale = interpolate(giftSp, [0, 1], [0.2, 1]);
  const rot = interpolate(giftSp, [0, 1], [-180, 0]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#0a0416">
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 30%, #4b0d7a 0%, #050010 70%)",
        }} />

        {/* title */}
        <div style={{
          position: "absolute", top: 100, left: 0, right: 0, textAlign: "center",
          fontFamily: "serif", color: "#ffd76a", fontSize: 68, fontWeight: 900,
          letterSpacing: 4, opacity: springIn(frame, fps, 0),
        }}>Luxury Gifts</div>
        <div style={{
          position: "absolute", top: 190, left: 0, right: 0, textAlign: "center",
          fontFamily: "sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 28,
          opacity: springIn(frame, fps, 6),
        }}>300+ animated · VIP exclusive</div>

        {/* mega gift */}
        <div style={{
          position: "absolute", top: 320, left: "50%",
          transform: `translateX(-50%) scale(${giftScale}) rotate(${rot}deg)`,
          width: 460, height: 460, borderRadius: "50%",
          background: "conic-gradient(from 0deg,#ff0090,#ffd76a,#b450ff,#ff0090)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 320,
          boxShadow: "0 0 120px #ff0090",
        }}>🎁</div>

        {/* sparkles */}
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2 + frame * 0.02;
          const r = 300 + Math.sin(frame * 0.1 + i) * 20;
          return (
            <div key={i} style={{
              position: "absolute", top: 550 + Math.sin(a) * r,
              left: `calc(50% + ${Math.cos(a) * r}px)`,
              fontSize: 50, opacity: 0.9,
            }}>✨</div>
          );
        })}

        {/* gifts grid at bottom */}
        <div style={{
          position: "absolute", bottom: 60, left: 40, right: 40,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20,
        }}>
          {GIFTS.map((g, i) => {
            const sp = springIn(frame, fps, 15 + i * 5);
            const y = interpolate(sp, [0,1], [80, 0]);
            return (
              <div key={i} style={{
                borderRadius: 24, padding: 20,
                background: "rgba(255,255,255,0.06)",
                border: "2px solid rgba(255,215,106,0.35)",
                textAlign: "center", fontFamily: "sans-serif", color: "#fff",
                transform: `translateY(${y}px)`, opacity: sp,
              }}>
                <div style={{ fontSize: 76 }}>{g.e}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{g.n}</div>
                <div style={{ fontSize: 20, color: "#ffd76a", fontWeight: 800 }}>💰 {g.p}</div>
              </div>
            );
          })}
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
