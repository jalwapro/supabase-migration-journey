import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

const ROOMS = [
  { name: "Neha 💃", tag: "Voice Room", viewers: "12.4K", c1: "#ff2d95", c2: "#b450ff" },
  { name: "Ali Khan 🎤", tag: "PK Battle", viewers: "8.7K", c1: "#ffd76a", c2: "#ff7a00" },
  { name: "Sara ✨", tag: "Video Live", viewers: "5.1K", c1: "#00d4ff", c2: "#7a00ff" },
  { name: "Zoya 🌹", tag: "Party Room", viewers: "3.9K", c1: "#ff5599", c2: "#ff0090" },
];

export const SceneHome = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);
  const headerY = interpolate(springIn(frame, fps, 0), [0, 1], [-60, 0]);
  const titleOp = springIn(frame, fps, 8);

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame>
        <div style={{ padding: "90px 40px 40px", fontFamily: "sans-serif", color: "#fff" }}>
          {/* header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            transform: `translateY(${headerY}px)`, opacity: titleOp,
          }}>
            <div>
              <div style={{ fontSize: 60, fontWeight: 900, color: "#ffd76a", fontFamily: "serif" }}>Jalwa</div>
              <div style={{ fontSize: 24, color: "rgba(255,255,255,0.7)" }}>Live rooms worldwide</div>
            </div>
            <div style={{
              width: 90, height: 90, borderRadius: "50%",
              background: "linear-gradient(135deg,#ff0090,#ffd76a)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
            }}>🔍</div>
          </div>

          {/* tabs */}
          <div style={{ display: "flex", gap: 24, marginTop: 40, fontSize: 30, fontWeight: 700 }}>
            {["Live", "Voice", "PK", "Video", "Party"].map((t, i) => (
              <div key={t} style={{
                padding: "14px 28px", borderRadius: 24,
                background: i === 0 ? "linear-gradient(135deg,#ff0090,#b450ff)" : "rgba(255,255,255,0.08)",
                color: i === 0 ? "#fff" : "rgba(255,255,255,0.6)",
              }}>{t}</div>
            ))}
          </div>

          {/* room grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 40 }}>
            {ROOMS.map((r, i) => {
              const delay = 20 + i * 8;
              const sp = springIn(frame, fps, delay);
              const y = interpolate(sp, [0, 1], [80, 0]);
              return (
                <div key={i} style={{
                  height: 520, borderRadius: 36,
                  background: `linear-gradient(160deg, ${r.c1}, ${r.c2})`,
                  padding: 24, position: "relative", overflow: "hidden",
                  transform: `translateY(${y}px)`, opacity: sp,
                  boxShadow: `0 20px 60px ${r.c1}55`,
                }}>
                  <div style={{
                    position: "absolute", top: 20, left: 20,
                    background: "rgba(0,0,0,0.5)", padding: "8px 18px",
                    borderRadius: 20, fontSize: 22, fontWeight: 800, color: "#ff5555",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: "#ff2d55" }} />
                    LIVE
                  </div>
                  <div style={{
                    position: "absolute", top: 20, right: 20,
                    background: "rgba(0,0,0,0.5)", padding: "8px 16px",
                    borderRadius: 20, fontSize: 22, fontWeight: 700,
                  }}>👥 {r.viewers}</div>
                  <div style={{ position: "absolute", bottom: 24, left: 24, right: 24 }}>
                    <div style={{ fontSize: 30, fontWeight: 800 }}>{r.name}</div>
                    <div style={{ fontSize: 22, opacity: 0.85 }}>{r.tag}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
