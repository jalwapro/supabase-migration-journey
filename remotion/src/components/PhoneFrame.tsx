import React from "react";
import { AbsoluteFill } from "remotion";

// Full-bleed 9:16 "screen" container with subtle bezel + status bar
export const PhoneFrame: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone = "#0a0416" }) => {
  return (
    <AbsoluteFill style={{ padding: 40, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 1000,
          height: 1800,
          borderRadius: 88,
          background: tone,
          border: "6px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 120px rgba(255,0,144,0.25), 0 0 0 2px rgba(255,215,106,0.12) inset",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* status bar */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 60,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 50px",
            color: "#fff",
            fontSize: 24,
            fontWeight: 600,
            zIndex: 10,
            fontFamily: "sans-serif",
          }}
        >
          <span>9:41</span>
          <span style={{ opacity: 0.8 }}>••• 5G ▮▮▮▮</span>
        </div>
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 18, left: "50%", transform: "translateX(-50%)",
            width: 220, height: 34, borderRadius: 20, background: "#000", zIndex: 20,
          }}
        />
        {children}
      </div>
    </AbsoluteFill>
  );
};
