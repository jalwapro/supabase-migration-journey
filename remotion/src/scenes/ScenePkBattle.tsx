import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

export const ScenePkBattle = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);

  // battle bar goes 30% -> 68%
  const barP = interpolate(frame, [20, 130], [30, 68], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vsScale = 1 + 0.1 * Math.sin(frame * 0.3);
  const shake = Math.sin(frame * 0.9) * 4;

  const Side = ({ side, name, score, color, emoji, delay }: any) => {
    const sp = springIn(frame, fps, delay);
    const x = interpolate(sp, [0,1], [side === "L" ? -300 : 300, 0]);
    return (
      <div style={{
        position: "absolute", top: 200, [side === "L" ? "left" : "right"]: 20,
        width: 440, height: 900, borderRadius: 36, overflow: "hidden",
        background: `linear-gradient(160deg, ${color}, #050010)`,
        transform: `translateX(${x}px)`,
        boxShadow: `0 0 60px ${color}aa`,
      } as any}>
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${color}55, transparent 65%)`,
        }} />
        <div style={{
          position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)",
          fontSize: 260, filter: `drop-shadow(0 0 30px ${color})`,
        }}>{emoji}</div>
        <div style={{
          position: "absolute", top: 20, left: 20, right: 20,
          display: "flex", justifyContent: "space-between", color: "#fff",
          fontFamily: "sans-serif", fontWeight: 800,
        }}>
          <div style={{ background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: 20, fontSize: 22 }}>
            {name}
          </div>
          <div style={{ background: "#ffd76a", color: "#000", padding: "8px 16px", borderRadius: 20, fontSize: 22 }}>
            💎 {score}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#0a0416">
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 50% 50%, #2d0b4d, #050010)",
        }} />
        {/* top header */}
        <div style={{
          position: "absolute", top: 90, left: 0, right: 0, textAlign: "center",
          fontFamily: "serif", color: "#ffd76a", fontSize: 62, fontWeight: 900,
          letterSpacing: 6, textShadow: "0 0 30px #ff0090",
          opacity: springIn(frame, fps, 0),
        }}>PK BATTLE</div>

        <Side side="L" name="Ali 🔥" score="12.4K" color="#ff2d95" emoji="🥊" delay={5} />
        <Side side="R" name="Omar ⚡" score="8.7K" color="#00d4ff" emoji="🥊" delay={5} />

        {/* VS badge */}
        <div style={{
          position: "absolute", top: 580, left: "50%",
          transform: `translate(-50%, 0) scale(${vsScale}) translate(${shake}px, 0)`,
          width: 220, height: 220, borderRadius: "50%",
          background: "conic-gradient(from 0deg, #ffd76a, #ff0090, #b450ff, #ffd76a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 100, fontWeight: 900, color: "#000", fontFamily: "serif",
          boxShadow: "0 0 60px #ff0090",
          border: "6px solid #0a0416",
        }}>VS</div>

        {/* battle bar */}
        <div style={{
          position: "absolute", bottom: 260, left: 60, right: 60,
          height: 40, borderRadius: 20, overflow: "hidden",
          background: "#00d4ff", boxShadow: "0 0 30px rgba(0,0,0,0.8)",
          border: "3px solid #fff",
        }}>
          <div style={{
            width: `${barP}%`, height: "100%",
            background: "linear-gradient(90deg,#ff2d95,#ffd76a)",
          }} />
        </div>

        {/* timer */}
        <div style={{
          position: "absolute", bottom: 130, left: 0, right: 0, textAlign: "center",
          color: "#ffd76a", fontSize: 90, fontWeight: 900, fontFamily: "monospace",
          textShadow: "0 0 30px #ff0090",
        }}>02:{String(59 - Math.floor(frame / 30) * 10).padStart(2, "0")}</div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
