import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Outfit";

const { fontFamily: display } = loadDisplay("normal", { weights: ["900"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["500", "700"], subsets: ["latin"] });

const items = [
  { icon: "🎙️", title: "Live Voice Rooms", sub: "Real-time audio parties" },
  { icon: "📹", title: "Video Rooms", sub: "Face-to-face with the world" },
  { icon: "💬", title: "Private Chat", sub: "Voice notes • media • more" },
];

export const SceneFeatures = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headSpring = spring({ frame, fps, config: { damping: 200 } });
  const headY = interpolate(headSpring, [0, 1], [-60, 0]);
  const headOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 48 }}>
      <div
        style={{
          fontFamily: display,
          color: "#fff",
          fontSize: 96,
          fontWeight: 900,
          lineHeight: 1,
          transform: `translateY(${headY}px)`,
          opacity: headOp,
          textShadow: "0 6px 40px rgba(255,60,170,0.4)",
        }}
      >
        A New <span style={{ color: "#ffd76a" }}>Universe</span>
        <br /> of Live.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 20 }}>
        {items.map((it, i) => {
          const delay = 15 + i * 10;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
          const x = interpolate(s, [0, 1], [-400, 0]);
          const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                transform: `translateX(${x}px)`,
                opacity: op,
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "24px 32px",
                borderRadius: 24,
                background: "linear-gradient(90deg, rgba(255,60,170,0.18), rgba(120,40,220,0.10))",
                border: "1px solid rgba(255,215,106,0.35)",
                backdropFilter: "blur(0)",
              }}
            >
              <div
                style={{
                  fontSize: 72,
                  filter: "drop-shadow(0 0 20px rgba(255,215,106,0.6))",
                }}
              >
                {it.icon}
              </div>
              <div>
                <div style={{ fontFamily: body, color: "#fff", fontSize: 46, fontWeight: 700 }}>
                  {it.title}
                </div>
                <div style={{ fontFamily: body, color: "#e6c9ff", fontSize: 28, opacity: 0.85 }}>
                  {it.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
