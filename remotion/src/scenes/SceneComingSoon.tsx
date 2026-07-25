import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/CinzelDecorative";
import { loadFont as loadBody } from "@remotion/google-fonts/Outfit";

const { fontFamily: display } = loadDisplay("normal", { weights: ["900"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["400", "700"], subsets: ["latin"] });

export const SceneComingSoon = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  const sweepX = interpolate(frame, [10, 70], [-1200, 1200]);
  const subOp = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [40, 70], [30, 0], { extrapolateRight: "clamp" });
  const pulse = 0.7 + 0.3 * Math.sin(frame / 6);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div
        style={{
          position: "relative",
          transform: `scale(${scale})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: display,
            fontSize: 180,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 0.95,
            letterSpacing: -2,
            background: "linear-gradient(180deg, #ffd76a 0%, #ff3caa 60%, #c084fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: `0 0 ${60 * pulse}px rgba(255,60,170,0.6)`,
            filter: `drop-shadow(0 0 ${30 * pulse}px rgba(255,215,106,0.55))`,
          }}
        >
          COMING
          <br />
          SOON
        </div>
        {/* shine sweep */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
            transform: `translateX(${sweepX}px)`,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 60,
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: body,
            fontSize: 44,
            color: "#fff",
            letterSpacing: 3,
            fontWeight: 700,
          }}
        >
          Get Ready. The Palace Opens Soon.
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: body,
            fontSize: 30,
            color: "#ffd76a",
            letterSpacing: 8,
          }}
        >
          iOS  •  ANDROID  •  WEB
        </div>
      </div>
    </AbsoluteFill>
  );
};
