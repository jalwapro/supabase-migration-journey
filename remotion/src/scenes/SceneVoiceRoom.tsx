import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

const SEATS = [
  { name: "Host Neha", emoji: "👑", c: "#ffd76a", host: true, speaking: true },
  { name: "Ali", emoji: "🎤", c: "#ff0090", speaking: false },
  { name: "Zara", emoji: "💎", c: "#b450ff", speaking: true },
  { name: "Omar", emoji: "🔥", c: "#ff7a00", speaking: false },
  { name: "Sara", emoji: "🌹", c: "#ff5599", speaking: true },
  { name: "Bilal", emoji: "⭐", c: "#00d4ff", speaking: false },
  { name: "Mira", emoji: "✨", c: "#7a00ff", speaking: false },
  { name: "Rehan", emoji: "🎧", c: "#ff2d95", speaking: false },
  { name: "Anaya", emoji: "🦋", c: "#ffd76a", speaking: true },
];

export const SceneVoiceRoom = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);
  const title = springIn(frame, fps, 0);

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#1a0538">
        {/* purple palace background */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 30%, #4b0d7a 0%, #2d0b4d 50%, #050010 100%)",
        }} />
        <div style={{ position: "absolute", inset: 0, padding: "90px 40px 40px", fontFamily: "sans-serif", color: "#fff" }}>
          {/* header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            opacity: title,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                background: "rgba(255,45,149,0.25)", padding: "10px 20px", borderRadius: 24,
                border: "2px solid #ff2d95", fontSize: 22, fontWeight: 800,
              }}>🎤 Royal Voice Room</div>
            </div>
            <div style={{
              background: "linear-gradient(135deg,#ffd76a,#ff7a00)", padding: "10px 22px",
              borderRadius: 22, fontSize: 22, fontWeight: 800, color: "#000",
            }}>💰 24.5K</div>
          </div>

          {/* 9 seats grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 40, marginTop: 120, padding: "0 30px",
          }}>
            {SEATS.map((s, i) => {
              const delay = 10 + i * 5;
              const sp = springIn(frame, fps, delay);
              const scale = interpolate(sp, [0, 1], [0, 1]);
              const pulse = s.speaking ? 1 + 0.08 * Math.sin(frame * 0.25 + i) : 1;
              return (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                  transform: `scale(${scale})`,
                }}>
                  <div style={{ position: "relative", width: s.host ? 220 : 180, height: s.host ? 220 : 180 }}>
                    {s.speaking && (
                      <div style={{
                        position: "absolute", inset: -20, borderRadius: "50%",
                        background: `radial-gradient(circle, ${s.c}88, transparent 70%)`,
                        transform: `scale(${pulse})`,
                        filter: "blur(8px)",
                      }} />
                    )}
                    {s.host && (
                      <div style={{
                        position: "absolute", inset: -14, borderRadius: "50%",
                        border: "4px dashed #ffd76a",
                        transform: `rotate(${frame * 1.5}deg)`,
                      }} />
                    )}
                    <div style={{
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: `linear-gradient(135deg, ${s.c}, #2d0b4d)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: s.host ? 100 : 82,
                      boxShadow: `0 0 40px ${s.c}77`,
                    }}>{s.emoji}</div>
                    {s.host && (
                      <div style={{
                        position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
                        fontSize: 60,
                      }}>👑</div>
                    )}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{s.name}</div>
                </div>
              );
            })}
          </div>

          {/* bottom mic bar */}
          <div style={{
            position: "absolute", bottom: 60, left: 40, right: 40,
            display: "flex", gap: 20, justifyContent: "center",
          }}>
            {["🎤", "🎁", "💬", "❤️", "⋯"].map((e, i) => (
              <div key={i} style={{
                width: 100, height: 100, borderRadius: "50%",
                background: i === 0 ? "linear-gradient(135deg,#ff0090,#b450ff)" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
                border: i === 0 ? "3px solid #ffd76a" : "2px solid rgba(255,255,255,0.15)",
              }}>{e}</div>
            ))}
          </div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
