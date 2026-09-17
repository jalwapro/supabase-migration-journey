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
    return Array.from(document.querySelectorAll<HTMLImageElement>("img[alt]"))
      .find((img) => img.alt.trim() === senderName.trim()) ?? null;
  }
  return null;
}

function play(payload: VoiceRoomEmojiPlayback) {
  if (typeof document === "undefined") return;
  const startedAt = performance.now();
  const attempt = () => {
    const target = findSeat(payload.targetSeatIndex);
    const sender = findSender(payload.senderId, payload.senderName);
    if (!target || !sender) {
      if (performance.now() - startedAt < 2500) {
        window.requestAnimationFrame(attempt);
      }
      return;
    }

    const sr = sender.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    if (!sr.width || !sr.height || !tr.width || !tr.height) return;

    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "2147483646", pointerEvents: "none" });
    layer.dataset.jalwaEmojiPlayback = payload.id;

    const node = document.createElement("div");
    Object.assign(node.style, {
      position: "fixed",
      left: `${sr.left + sr.width / 2 - 25}px`,
      top: `${sr.top + sr.height / 2 - 25}px`,
      width: "50px",
      height: "50px",
      display: "grid",
      placeItems: "center",
      fontSize: "40px",
      willChange: "transform,opacity",
      filter: "drop-shadow(0 0 12px rgba(255,215,0,.95))",
    });

    if (payload.url || payload.clipPath) {
      const img = document.createElement("img");
      img.src = payload.url || payload.clipPath || "";
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain" });
      img.alt = payload.emoji;
      img.onerror = () => { img.remove(); node.textContent = payload.emoji || "✨"; };
      node.appendChild(img);
    } else {
      node.textContent = payload.emoji || "✨";
    }

    layer.appendChild(node);
    document.body.appendChild(layer);

    const dx = tr.left + tr.width / 2 - (sr.left + sr.width / 2);
    const dy = tr.top + tr.height / 2 - (sr.top + sr.height / 2);
    const animation = node.animate([
      { transform: "translate3d(0,0,0) scale(.7) rotate(-8deg)", opacity: 0 },
      { transform: `translate3d(${dx * .4}px,${dy * .4 - 34}px,0) scale(1.15) rotate(8deg)`, opacity: 1, offset: .32 },
      { transform: `translate3d(${dx * .75}px,${dy * .75 + 8}px,0) scale(1.02) rotate(-4deg)`, opacity: 1, offset: .72 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(.65)`, opacity: 1 },
    ], { duration: 1000, easing: "cubic-bezier(.22,.75,.25,1)", fill: "forwards" });
    window.setTimeout(() => { animation.cancel(); layer.remove(); }, 1350);
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
