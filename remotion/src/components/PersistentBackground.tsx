import { AbsoluteFill, useCurrentFrame } from "remotion";

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (i * 137.5) % 100,
  y: (i * 73.7) % 100,
  size: (i % 4) + 1,
  delay: (i * 13) % 90,
}));

export const PersistentBackground = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {/* base gradient */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 20% 15%, #4b0d7a 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, #7a1064 0%, transparent 55%), linear-gradient(180deg, #1a0b2e 0%, #2d0b4d 50%, #050010 100%)",
        }}
      />
      {/* aurora sweep */}
      <AbsoluteFill
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, transparent 0deg, rgba(255,0,144,0.15) 40deg, transparent 90deg, rgba(180,80,255,0.2) 200deg, transparent 300deg)",
          transform: `rotate(${frame * 0.3}deg)`,
          filter: "blur(60px)",
          opacity: 0.55,
        }}
      />
      {/* stars */}
      {STARS.map((s, i) => {
        const t = (frame + s.delay) / 30;
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: i % 5 === 0 ? "#ffd76a" : "#ffffff",
              opacity: twinkle,
              boxShadow: `0 0 ${s.size * 4}px currentColor`,
              color: i % 5 === 0 ? "#ffd76a" : "#ffffff",
            }}
          />
        );
      })}
      {/* vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
