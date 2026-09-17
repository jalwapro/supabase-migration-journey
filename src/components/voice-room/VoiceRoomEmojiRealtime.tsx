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

function getAvatarRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  const avatar = element.querySelector<HTMLElement>("img, [data-avatar], video");
  const rect = (avatar ?? element).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function play(payload: VoiceRoomEmojiPlayback) {
  if (typeof document === "undefined") return;
  const startedAt = performance.now();
  const attempt = () => {
    const target = findSeat(payload.targetSeatIndex);
    const sender = findSender(payload.senderId, payload.senderName);
    const sr = getAvatarRect(sender);
    const tr = getAvatarRect(target);
    if (!target || !sender || !sr || !tr) {
      if (performance.now() - startedAt < 2500) window.requestAnimationFrame(attempt);
      return;
    }

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

    // Recalculate from the actual avatar center, not the seat wrapper/name row.
    // This makes the final frame land directly on the recipient DP on mobile and desktop.
    const startX = sr.left + sr.width / 2;
    const startY = sr.top + sr.height / 2;
    const endX = tr.left + tr.width / 2;
    const endY = tr.top + tr.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;

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
