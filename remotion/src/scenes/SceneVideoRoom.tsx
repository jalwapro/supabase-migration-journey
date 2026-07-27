import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

export const SceneVideoRoom = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);
  const heart = (i: number) => {
    const t = (frame + i * 20) % 90;
    const y = interpolate(t, [0, 90], [0, -400]);
    const op = interpolate(t, [0, 20, 70, 90], [0, 1, 1, 0]);
    return { y, op };
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#000">
        {/* faux host "camera" background */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(160deg, #ff5599 0%, #7a00ff 55%, #050010 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 50% 40%, rgba(255,215,106,0.35), transparent 60%)",
        }} />
        {/* host silhouette */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 900,
          background: "radial-gradient(ellipse at 50% 20%, #ffd76a 0%, #ff0090 40%, transparent 70%)",
          filter: "blur(30px)", opacity: 0.7,
        }} />
        <div style={{
          position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)",
          fontSize: 500, filter: "drop-shadow(0 0 40px #ff0090)",
        }}>💃</div>

        {/* floating hearts */}
        {[0,1,2,3,4,5,6,7].map(i => {
          const h = heart(i);
          const x = 100 + (i * 100) % 800;
          return (
            <div key={i} style={{
              position: "absolute", left: x, bottom: 300 + h.y, fontSize: 60, opacity: h.op,
            }}>{i % 2 ? "💖" : "❤️"}</div>
          );
        })}

        {/* top overlay */}
        <div style={{
          position: "absolute", top: 80, left: 40, right: 40,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          fontFamily: "sans-serif", color: "#fff",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(0,0,0,0.5)", padding: "12px 20px", borderRadius: 40,
            opacity: springIn(frame, fps, 0),
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: "50%",
              background: "linear-gradient(135deg,#ffd76a,#ff0090)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
            }}>👑</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>Sara ✨</div>
              <div style={{ fontSize: 20, opacity: 0.8 }}>Lv 42 · 🎁 Top host</div>
            </div>
            <div style={{
              marginLeft: 12, background: "linear-gradient(135deg,#ff0090,#b450ff)",
              padding: "8px 18px", borderRadius: 20, fontSize: 20, fontWeight: 800,
            }}>+ Follow</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
            <div style={{
              background: "rgba(255,45,85,0.9)", padding: "10px 20px", borderRadius: 24,
              fontSize: 22, fontWeight: 800, display: "flex", gap: 8, alignItems: "center",
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: "#fff" }} />
              LIVE · 18.2K
            </div>
          </div>
        </div>

        {/* incoming gift toast */}
        {frame > 60 && (
          <div style={{
            position: "absolute", top: 260, left: 40,
            display: "flex", alignItems: "center", gap: 14,
            background: "linear-gradient(135deg,#ffd76a,#ff7a00)",
            padding: "14px 22px", borderRadius: 40,
            fontSize: 24, fontWeight: 800, color: "#000",
            transform: `translateX(${interpolate(springIn(frame, fps, 60), [0,1], [-400,0])}px)`,
            boxShadow: "0 0 40px #ff7a00aa",
            fontFamily: "sans-serif",
          }}>🎁 Bilal sent Money Gun × 500</div>
        )}

        {/* chat input */}
        <div style={{
          position: "absolute", bottom: 60, left: 40, right: 40,
          display: "flex", gap: 14, alignItems: "center", fontFamily: "sans-serif",
        }}>
          <div style={{
            flex: 1, background: "rgba(0,0,0,0.55)", padding: "18px 26px",
            borderRadius: 40, color: "rgba(255,255,255,0.7)", fontSize: 22,
          }}>Say something nice…</div>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg,#ff0090,#ffd76a)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
          }}>🎁</div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
