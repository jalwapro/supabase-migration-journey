import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { sceneFade, springIn } from "../lib/motion";
import { PhoneFrame } from "../components/PhoneFrame";

const TOP = [
  { r: 2, name: "Ali Khan", coins: "982K", emoji: "🥈", c: "#b450ff", h: 320 },
  { r: 1, name: "Neha ✨", coins: "1.2M", emoji: "👑", c: "#ffd76a", h: 420 },
  { r: 3, name: "Sara 🌹", coins: "764K", emoji: "🥉", c: "#ff7a00", h: 260 },
];

const LIST = [
  { r: 4, name: "Bilal", coins: "612K" },
  { r: 5, name: "Zara 💎", coins: "540K" },
  { r: 6, name: "Omar 🔥", coins: "482K" },
  { r: 7, name: "Mira ✨", coins: "410K" },
  { r: 8, name: "Rehan 🎧", coins: "376K" },
];

export const SceneRanking = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sceneFade(frame, 150);

  return (
    <AbsoluteFill style={{ opacity }}>
      <PhoneFrame tone="#0a0416">
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 20%, #4b0d7a 0%, #050010 70%)",
        }} />

        {/* title */}
        <div style={{
          position: "absolute", top: 100, left: 0, right: 0, textAlign: "center",
          fontFamily: "serif", color: "#ffd76a", fontSize: 72, fontWeight: 900,
          letterSpacing: 4, opacity: springIn(frame, fps, 0),
          textShadow: "0 0 30px #ff0090",
        }}>🏆 Top Rankings</div>
        <div style={{
          position: "absolute", top: 210, left: 0, right: 0, textAlign: "center",
          color: "rgba(255,255,255,0.7)", fontSize: 26, fontFamily: "sans-serif",
        }}>Weekly · Global Hosts</div>

        {/* podium */}
        <div style={{
          position: "absolute", top: 320, left: 40, right: 40,
          display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 24,
        }}>
          {TOP.map((t, i) => {
            const sp = springIn(frame, fps, 10 + i * 8);
            const hh = interpolate(sp, [0, 1], [0, t.h]);
            return (
              <div key={i} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 16,
              }}>
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 60, position: "absolute", top: -70, left: "50%", transform: "translateX(-50%)" }}>
                    {t.emoji}
                  </div>
                  <div style={{
                    width: 180, height: 180, borderRadius: "50%",
                    background: `linear-gradient(135deg,${t.c},#2d0b4d)`,
                    border: `5px solid ${t.c}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90,
                    boxShadow: `0 0 40px ${t.c}aa`,
                    opacity: sp,
                  }}>👤</div>
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 28, fontFamily: "sans-serif" }}>{t.name}</div>
                <div style={{ color: "#ffd76a", fontWeight: 900, fontSize: 26 }}>💰 {t.coins}</div>
                <div style={{
                  width: "100%", height: hh, borderRadius: "20px 20px 0 0",
                  background: `linear-gradient(180deg,${t.c},${t.c}44)`,
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                  paddingTop: 20, fontSize: 60, fontWeight: 900, color: "#0a0416",
                  fontFamily: "serif",
                  boxShadow: `0 0 30px ${t.c}66`,
                }}>{t.r}</div>
              </div>
            );
          })}
        </div>

        {/* list */}
        <div style={{ position: "absolute", bottom: 60, left: 40, right: 40, display: "flex", flexDirection: "column", gap: 14 }}>
          {LIST.map((u, i) => {
            const sp = springIn(frame, fps, 40 + i * 6);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 20,
                padding: "18px 24px", borderRadius: 24,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,215,106,0.25)",
                transform: `translateX(${interpolate(sp,[0,1],[80,0])}px)`, opacity: sp,
                fontFamily: "sans-serif",
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "linear-gradient(135deg,#ffd76a,#ff0090)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, color: "#000", fontSize: 26,
                }}>{u.r}</div>
                <div style={{ flex: 1, color: "#fff", fontWeight: 700, fontSize: 26 }}>{u.name}</div>
                <div style={{ color: "#ffd76a", fontWeight: 800, fontSize: 24 }}>💰 {u.coins}</div>
              </div>
            );
          })}
        </div>
      </PhoneFrame>

      {/* end-card CTA overlay in the final 30 frames */}
      {frame > 110 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `rgba(5,0,16,${interpolate(frame,[110,150],[0,0.9])})`,
          flexDirection: "column",
          opacity: interpolate(frame, [110, 130], [0, 1]),
        }}>
          <div style={{
            fontSize: 200, fontWeight: 900, color: "#ffd76a",
            fontFamily: "serif", letterSpacing: 12,
            textShadow: "0 0 60px #ff0090",
          }}>JALWA</div>
          <div style={{ fontSize: 44, color: "#fff", marginTop: 10, letterSpacing: 4, fontFamily: "sans-serif" }}>
            Download Now
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
