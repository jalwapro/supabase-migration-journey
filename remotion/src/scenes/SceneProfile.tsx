import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

const STATS = [
  { k: "Followers", v: "128K", c: "#ff0090" },
  { k: "Diamonds", v: "45.2K", c: "#00d4ff" },
  { k: "Level", v: "Lv 42", c: "#ffd76a" },
  { k: "VIP", v: "👑 GOLD", c: "#b450ff" },
];

export const SceneProfile = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);
  const avatarSp = springIn(frame, fps, 5, 10);
  const nameSp = springIn(frame, fps, 20);

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#0a0416">
        {/* hero bg */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 900,
          background: "linear-gradient(180deg, #ff0090 0%, #b450ff 45%, #0a0416 100%)",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 900,
          background: "radial-gradient(circle at 50% 60%, rgba(255,215,106,0.4), transparent 60%)",
        }} />

        {/* avatar + frame */}
        <div style={{
          position: "absolute", top: 240, left: "50%",
          transform: `translateX(-50%) scale(${avatarSp})`,
          width: 380, height: 380,
        }}>
          <div style={{
            position: "absolute", inset: -30, borderRadius: "50%",
            border: "6px dashed #ffd76a",
            transform: `rotate(${frame * 1.2}deg)`,
          }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg,#ffd76a,#ff0090,#b450ff,#ffd76a)",
            padding: 12,
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "linear-gradient(135deg,#ff2d95,#7a00ff)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 200,
            }}>👸</div>
          </div>
          <div style={{
            position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)",
            background: "linear-gradient(135deg,#ffd76a,#ff7a00)",
            padding: "10px 24px", borderRadius: 30,
            fontSize: 26, fontWeight: 900, color: "#000", fontFamily: "sans-serif",
          }}>Lv 42</div>
        </div>

        {/* name */}
        <div style={{
          position: "absolute", top: 700, left: 0, right: 0, textAlign: "center",
          color: "#fff", fontFamily: "serif", fontWeight: 900,
          opacity: nameSp,
          transform: `translateY(${interpolate(nameSp, [0,1], [30, 0])}px)`,
        }}>
          <div style={{ fontSize: 68 }}>Neha ✨</div>
          <div style={{ fontSize: 28, color: "#ffd76a", letterSpacing: 4, fontFamily: "sans-serif" }}>
            ID · 8829174
          </div>
        </div>

        {/* stats */}
        <div style={{
          position: "absolute", top: 900, left: 40, right: 40,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
        }}>
          {STATS.map((s, i) => {
            const sp = springIn(frame, fps, 30 + i * 6);
            return (
              <div key={i} style={{
                borderRadius: 28, padding: 30,
                background: `linear-gradient(135deg, ${s.c}44, rgba(255,255,255,0.04))`,
                border: `2px solid ${s.c}88`,
                fontFamily: "sans-serif", color: "#fff",
                transform: `translateY(${interpolate(sp,[0,1],[40,0])}px)`, opacity: sp,
              }}>
                <div style={{ fontSize: 24, opacity: 0.7 }}>{s.k}</div>
                <div style={{ fontSize: 52, fontWeight: 900, color: s.c }}>{s.v}</div>
              </div>
            );
          })}
        </div>

        {/* action bar */}
        <div style={{
          position: "absolute", bottom: 80, left: 40, right: 40,
          display: "flex", gap: 20,
        }}>
          {[
            { l: "Follow", c: "linear-gradient(135deg,#ff0090,#ffd76a)" },
            { l: "Message", c: "rgba(255,255,255,0.1)" },
            { l: "Gift 🎁", c: "linear-gradient(135deg,#ffd76a,#ff7a00)" },
          ].map((b, i) => (
            <div key={i} style={{
              flex: 1, padding: "24px 0", textAlign: "center",
              borderRadius: 36, background: b.c,
              color: "#fff", fontWeight: 800, fontSize: 26, fontFamily: "sans-serif",
              border: "2px solid rgba(255,255,255,0.15)",
            }}>{b.l}</div>
          ))}
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
