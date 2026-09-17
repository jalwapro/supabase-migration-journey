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

function avatarRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  const candidate = element.querySelector<HTMLElement>("img[alt], img, [data-avatar], video") ?? element;
  const rect = candidate.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

/**
 * Voice-room emojis are seat reactions, not chat splashes. Render the selected
 * emoji directly over the recipient's avatar for a short moment. This is also
 * used by the sender locally so both sides use exactly the same renderer.
 */
export function playVoiceRoomEmojiAtSeat(payload: Pick<VoiceRoomEmojiPlayback, "targetSeatIndex" | "emoji" | "url" | "clipPath">) {
  if (typeof document === "undefined") return;
  const startedAt = performance.now();

  const attempt = () => {
    const seat = findSeat(payload.targetSeatIndex);
    const rect = avatarRect(seat);
    if (!rect) {
      if (performance.now() - startedAt < 4000) window.requestAnimationFrame(attempt);
      return;
    }

    const layer = document.createElement("div");
    Object.assign(layer.style, {
      position: "fixed",
      left: `${rect.left - 10}px`,
      top: `${rect.top - 10}px`,
      width: `${rect.width + 20}px`,
      height: `${rect.height + 20}px`,
      zIndex: "2147483647",
      pointerEvents: "none",
      display: "grid",
      placeItems: "center",
      borderRadius: "999px",
      overflow: "visible",
    });
    layer.dataset.jalwaSeatEmoji = "true";

    const glow = document.createElement("div");
    Object.assign(glow.style, {
      position: "absolute",
      inset: "-4px",
      borderRadius: "999px",
      background: "radial-gradient(circle, rgba(251,191,36,.28), transparent 68%)",
      boxShadow: "0 0 24px rgba(251,191,36,.55)",
      pointerEvents: "none",
    });
    layer.appendChild(glow);

    const node = document.createElement("div");
    Object.assign(node.style, {
      position: "relative",
      width: `${Math.max(42, Math.min(72, rect.width * 0.95))}px`,
      height: `${Math.max(42, Math.min(72, rect.height * 0.95))}px`,
      display: "grid",
      placeItems: "center",
      fontSize: `${Math.max(30, Math.min(52, rect.width * 0.72))}px`,
      lineHeight: "1",
      transform: "scale(.55)",
      opacity: "0",
      willChange: "transform,opacity",
      pointerEvents: "none",
      filter: "drop-shadow(0 0 10px rgba(255,215,0,.95))",
    });

    const fallback = document.createElement("span");
    fallback.textContent = payload.emoji || "✨";
    Object.assign(fallback.style, { display: "grid", placeItems: "center", width: "100%", height: "100%" });
    node.appendChild(fallback);

    const src = payload.url || payload.clipPath || "";
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = payload.emoji || "Emoji";
      Object.assign(img.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        pointerEvents: "none",
      });
      img.onerror = () => img.remove();
      node.appendChild(img);
    }

    layer.appendChild(node);
    document.body.appendChild(layer);

    let animation: Animation | null = null;
    try {
      animation = node.animate(
        [
          { transform: "scale(.55)", opacity: 0 },
          { transform: "scale(1.08)", opacity: 1, offset: .22 },
          { transform: "scale(1)", opacity: 1, offset: .72 },
          { transform: "scale(.88)", opacity: 0 },
        ],
        { duration: 1250, easing: "cubic-bezier(.22,.75,.25,1)", fill: "forwards" },
      );
    } catch {
      node.style.transform = "scale(1)";
      node.style.opacity = "1";
    }

    window.setTimeout(() => {
      animation?.cancel();
      layer.remove();
    }, 1350);
  };

  attempt();
}

export function VoiceRoomEmojiRealtime({ roomId }: { roomId: string; userId?: string | null }) {
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`voice-emoji-player-${roomId}`, {
      config: { private: false, broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "emoji_play" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        const p = payload as VoiceRoomEmojiPlayback;
        if (p.roomId !== roomId || !p.id || !Number.isInteger(p.targetSeatIndex)) return;
        playVoiceRoomEmojiAtSeat(p);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  return null;
}

export async function broadcastVoiceRoomEmoji(payload: VoiceRoomEmojiPlayback) {
  const channel = supabase.channel(`voice-emoji-player-${payload.roomId}`, {
    config: { private: false, broadcast: { self: false, ack: true } },
  });
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
