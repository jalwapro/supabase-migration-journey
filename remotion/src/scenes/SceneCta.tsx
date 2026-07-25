import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/CinzelDecorative";
import { loadFont as loadBody } from "@remotion/google-fonts/Outfit";

const { fontFamily: display } = loadDisplay("normal", { weights: ["900"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["500", "700"], subsets: ["latin"] });

export const SceneCta = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoS = spring({ frame, fps, config: { damping: 14 } });
  const logoScale = interpolate(logoS, [0, 1], [0.4, 1]);
  const nameOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const handleOp = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const ring = frame * 1.5;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 6);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60, gap: 40 }}>
      <div style={{ position: "relative", width: 380, height: 380 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px dashed #ffd76a",
            transform: `rotate(${ring}deg)`,
            boxShadow: `0 0 ${60 * pulse}px rgba(255,215,106,0.5)`,
          }}
        />
        <Img
          src={staticFile("images/logo.png")}
          style={{
            position: "absolute",
            inset: 24,
            width: 332,
            height: 332,
            borderRadius: "50%",
            objectFit: "cover",
            transform: `scale(${logoScale})`,
            border: "3px solid #ff3caa",
            boxShadow: "0 0 40px rgba(255,60,170,0.7)",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: display,
          fontSize: 84,
          fontWeight: 900,
          color: "#ffd76a",
          letterSpacing: 4,
          opacity: nameOp,
          textShadow: "0 0 30px rgba(255,215,106,0.6)",
        }}
      >
        JALWA
      </div>
      <div
        style={{
          marginTop: -20,
          fontFamily: body,
          fontSize: 32,
          color: "#fff",
          letterSpacing: 10,
          opacity: nameOp,
        }}
      >
        GLOBAL LIVE
      </div>

      <div
        style={{
          marginTop: 40,
          padding: "22px 46px",
          borderRadius: 999,
          background: "linear-gradient(90deg, #ff3caa, #c084fc)",
          fontFamily: body,
          fontSize: 38,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: 2,
          opacity: handleOp,
          boxShadow: "0 20px 60px rgba(255,60,170,0.45)",
        }}
      >
        Follow @jalwaglobal
      </div>

      <div
        style={{
          marginTop: 10,
          fontFamily: body,
          fontSize: 28,
          color: "#e6c9ff",
          opacity: handleOp,
          letterSpacing: 3,
        }}
      >
        jalwaglobal.live
      </div>
    </AbsoluteFill>
  );
};
