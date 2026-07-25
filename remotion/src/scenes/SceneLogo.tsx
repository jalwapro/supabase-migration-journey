import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/CinzelDecorative";
import { loadFont as loadBody } from "@remotion/google-fonts/Outfit";

const { fontFamily: display } = loadDisplay("normal", { weights: ["700", "900"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["400", "600"], subsets: ["latin"] });

export const SceneLogo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 90 } });
  const scale = interpolate(s, [0, 1], [0.3, 1]);
  const glowPulse = 0.6 + 0.4 * Math.sin(frame / 8);
  const ringRotate = frame * 1.2;
  const tagOp = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [30, 60], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      {/* rotating gold ring */}
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          border: "3px dashed rgba(255, 215, 106, 0.7)",
          transform: `rotate(${ringRotate}deg) scale(${scale})`,
          boxShadow: `0 0 ${80 * glowPulse}px rgba(255, 215, 106, 0.5)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          border: "1px solid rgba(255, 60, 170, 0.5)",
          transform: `rotate(${-ringRotate * 0.6}deg) scale(${scale})`,
        }}
      />

      <div
        style={{
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,106,0.35) 0%, transparent 70%)",
          position: "absolute",
          filter: `blur(${20 * glowPulse}px)`,
        }}
      />

      <Img
        src={staticFile("images/logo.png")}
        style={{
          width: 420,
          height: 420,
          borderRadius: "50%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          boxShadow: "0 0 60px rgba(255, 60, 170, 0.6), inset 0 0 30px rgba(0,0,0,0.4)",
          border: "4px solid #ffd76a",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 320,
          textAlign: "center",
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: display,
            color: "#ffd76a",
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: 6,
            textShadow: "0 0 30px rgba(255,215,106,0.7)",
          }}
        >
          JALWA
        </div>
        <div
          style={{
            fontFamily: body,
            color: "#ffffff",
            fontSize: 34,
            letterSpacing: 12,
            marginTop: 8,
            opacity: 0.9,
          }}
        >
          GLOBAL LIVE
        </div>
      </div>
    </AbsoluteFill>
  );
};
