import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceRoomEmojiPlayback = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string | null;
  targetSeatIndex: number;
  emoji: string;
  url: string | null;
  clipPath: string | null;
};

function findSeat(index: number) {
  return document.querySelector<HTMLElement>(`[data-seat-index="${index}"]`);
}

function findSender(senderId: string | null, senderName: string | null) {
  if (senderId) {
    const byId = document.querySelector<HTMLElement>(`[data-user-dp="${CSS.escape(senderId)}"]`);
    if (byId) return byId;
  }
  if (senderName) {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-user-dp]"))
      .find((seat) => Array.from(seat.querySelectorAll<HTMLImageElement>("img[alt]"))
        .some((img) => img.alt.trim() === senderName.trim())) ?? null;
  }
  return null;
}

function avatarCenter(element: HTMLElement | null) {
  if (!element) return null;
  const candidates = [
    element.querySelector<HTMLElement>("img[alt]"),
    element.querySelector<HTMLElement>("img"),
    element.querySelector<HTMLElement>("[data-avatar]"),
    element,
  ];
  for (const candidate of candidates) {
    const r = candidate?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

function play(payload: VoiceRoomEmojiPlayback) {
  if (typeof document === "undefined") return;
  const startedAt = performance.now();
  const attempt = () => {
    const target = findSeat(payload.targetSeatIndex);
    const sender = findSender(payload.senderId, payload.senderName);
    const start = avatarCenter(sender);
    const end = avatarCenter(target);
    if (!start || !end) {
      if (performance.now() - startedAt < 4000) window.requestAnimationFrame(attempt);
      return;
    }

    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none", overflow: "visible" });
    layer.dataset.jalwaEmojiPlayback = payload.id;

    const node = document.createElement("div");
    Object.assign(node.style, {
      position: "fixed", left: `${start.x - 28}px`, top: `${start.y - 28}px`, width: "56px", height: "56px",
      display: "grid", placeItems: "center", fontSize: "42px", willChange: "transform,opacity",
      transform: "translate3d(0,0,0)", opacity: "1", pointerEvents: "none",
    });

    const img = document.createElement("img");
    img.src = payload.url || payload.clipPath || "";
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 0 10px rgba(255,215,0,.9))" });
    img.alt = payload.emoji || "Animated emoji";
    img.onerror = () => { img.remove(); node.textContent = payload.emoji || "✨"; };
    if (img.src) node.appendChild(img); else node.textContent = payload.emoji || "✨";

    layer.appendChild(node);
    document.body.appendChild(layer);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const animation = node.animate([
      { transform: "translate3d(0,0,0) scale(.55) rotate(-10deg)", opacity: 1 },
      { transform: `translate3d(${dx * .35}px,${dy * .35 - 30}px,0) scale(1.2) rotate(10deg)`, opacity: 1, offset: .3 },
      { transform: `translate3d(${dx * .72}px,${dy * .72 + 8}px,0) scale(1.05) rotate(-5deg)`, opacity: 1, offset: .7 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(.7)`, opacity: 1 },
    ], { duration: 1000, easing: "cubic-bezier(.22,.75,.25,1)", fill: "forwards" });

    const impact = document.createElement("div");
    Object.assign(impact.style, { position: "fixed", left: `${end.x - 32}px`, top: `${end.y - 32}px`, width: "64px", height: "64px", borderRadius: "50%", border: "3px solid rgba(251,191,36,.95)", boxShadow: "0 0 28px rgba(251,191,36,.9)", opacity: "0", pointerEvents: "none" });
    layer.appendChild(impact);
    const impactAnimation = impact.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 300, delay: 950, easing: "ease-out", fill: "forwards" });
    window.setTimeout(() => { animation.cancel(); impactAnimation.cancel(); layer.remove(); }, 1400);
  };
  attempt();
}

export function VoiceRoomEmojiRealtime({ roomId, userId }: { roomId: string; userId: string | null }) {
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`voice-emoji-player-${roomId}`, { config: { private: false, broadcast: { self: false } } });
    channel.on("broadcast", { event: "emoji_play" }, ({ payload }) => {
      if (!payload || typeof payload !== "object") return;
      const p = payload as VoiceRoomEmojiPlayback;
      if (p.roomId !== roomId || !p.id || p.senderId === userId || !Number.isInteger(p.targetSeatIndex)) return;
      play(p);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId, userId]);
  return null;
}

export async function broadcastVoiceRoomEmoji(payload: VoiceRoomEmojiPlayback) {
  const channel = supabase.channel(`voice-emoji-player-${payload.roomId}`, { config: { private: false, broadcast: { self: false, ack: true } } });
  try {
    await new Promise<void>((resolve, reject) => channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error(`Emoji channel ${status}`));
    }));
    const result = await channel.send({ type: "broadcast", event: "emoji_play", payload });
    if (result !== "ok") throw new Error("Emoji broadcast was not acknowledged");
  } finally {
    void supabase.removeChannel(channel);
  }
}
