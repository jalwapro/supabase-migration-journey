import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { sceneFade, springIn } from "../lib/motion";

export const SceneSplash = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = 150;
  const opacity = sceneFade(frame, total);

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const ringRot = frame * 2;
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const tagY = interpolate(springIn(frame, fps, 25), [0, 1], [40, 0]);
  const tagOp = springIn(frame, fps, 25);
  const shine = interpolate(frame, [40, 100], [-500, 500], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      {/* aura */}
      <div style={{
        position: "absolute", width: 900, height: 900, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,0,144,0.35), rgba(180,80,255,0.15) 40%, transparent 70%)",
        filter: `blur(40px)`, opacity: glow,
      }} />
      {/* orbit ring */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        border: "3px dashed rgba(255,215,106,0.6)", transform: `rotate(${ringRot}deg)`,
      }} />
      {/* logo disk */}
      <div style={{
        width: 460, height: 460, borderRadius: "50%",
        background: "conic-gradient(from 0deg, #ff0090, #ffd76a, #b450ff, #ff0090)",
        transform: `scale(${logoScale})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 120px rgba(255,0,144,0.7)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          width: 420, height: 420, borderRadius: "50%", background: "#0a0416",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 260, fontWeight: 900, color: "#ffd76a", fontFamily: "serif",
          letterSpacing: -8,
        }}>J</div>
        <div style={{
          position: "absolute", top: 0, left: shine, width: 200, height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
          filter: "blur(20px)",
        }} />
      </div>
      <div style={{
        position: "absolute", bottom: 380, textAlign: "center",
        transform: `translateY(${tagY}px)`, opacity: tagOp,
      }}>
        <div style={{ fontSize: 130, fontWeight: 900, color: "#fff", letterSpacing: 8, fontFamily: "serif" }}>
          JALWA
        </div>
        <div style={{ fontSize: 42, color: "#ffd76a", letterSpacing: 12, marginTop: 10, fontFamily: "sans-serif" }}>
          GLOBAL LIVE
        </div>
      </div>
    </AbsoluteFill>
  );
};
