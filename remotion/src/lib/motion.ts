import { interpolate, spring } from "remotion";

export const fadeIn = (frame: number, start = 0, dur = 20) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const fadeOut = (frame: number, endFrame: number, dur = 15) =>
  interpolate(frame, [endFrame - dur, endFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const sceneFade = (frame: number, total: number, inDur = 18, outDur = 18) =>
  Math.min(fadeIn(frame, 0, inDur), fadeOut(frame, total, outDur));

export const springIn = (frame: number, fps: number, delay = 0, damping = 14) =>
  spring({ frame: frame - delay, fps, config: { damping, stiffness: 140 } });

export const drift = (frame: number, amp = 8, speed = 0.03) => Math.sin(frame * speed) * amp;
