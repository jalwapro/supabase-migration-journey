import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Outfit";

const { fontFamily: display } = loadDisplay("normal", { weights: ["900"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["600"], subsets: ["latin"] });

const chips = [
  { label: "PK Battles", emoji: "🥊", color: "#ff3caa" },
  { label: "Luxury Gifts", emoji: "💎", color: "#ffd76a" },
  { label: "VIP Levels", emoji: "👑", color: "#c084fc" },
  { label: "DP Frames", emoji: "🖼️", color: "#22d3ee" },
  { label: "Rankings", emoji: "🏆", color: "#f97316" },
  { label: "Wallet", emoji: "💰", color: "#facc15" },
];

const emojiRain = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 79) % 100,
  delay: (i * 7) % 60,
  emoji: ["💎", "👑", "🌹", "🚀", "💰", "❤️"][i % 6],
  drift: ((i * 31) % 40) - 20,
}));

export const SceneGifts = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 80, justifyContent: "center", overflow: "hidden" }}>
      {/* rain */}
      {emojiRain.map((r, i) => {
        const t = (frame + r.delay) / 90;
        const y = interpolate(t % 1, [0, 1], [-200, 2100]);
        const rot = (frame + r.delay) * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${r.x}%`,
              top: 0,
              transform: `translate(${r.drift}px, ${y}px) rotate(${rot}deg)`,
              fontSize: 60,
              filter: "drop-shadow(0 0 15px rgba(255,215,106,0.6))",
              opacity: 0.85,
            }}
          >
            {r.emoji}
          </div>
        );
      })}

      <div
        style={{
          fontFamily: display,
          color: "#fff",
          fontSize: 100,
          fontWeight: 900,
          lineHeight: 1,
          opacity: headOp,
          textShadow: "0 6px 40px rgba(255,215,106,0.4)",
        }}
      >
        Gift. <span style={{ color: "#ff3caa" }}>Battle.</span>
        <br /> <span style={{ color: "#ffd76a" }}>Reign.</span>
      </div>

      <div
        style={{
          marginTop: 60,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {chips.map((c, i) => {
          const delay = 20 + i * 6;
          const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });
          const scale = interpolate(s, [0, 1], [0.4, 1]);
          const op = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                transform: `scale(${scale})`,
                opacity: op,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "22px 32px",
                borderRadius: 999,
                background: "rgba(20,5,45,0.7)",
                border: `2px solid ${c.color}`,
                boxShadow: `0 0 24px ${c.color}55`,
              }}
            >
              <span style={{ fontSize: 44 }}>{c.emoji}</span>
              <span style={{ fontFamily: body, color: "#fff", fontSize: 36, fontWeight: 600 }}>
                {c.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
