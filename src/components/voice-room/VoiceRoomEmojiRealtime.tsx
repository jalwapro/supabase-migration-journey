import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceRoomEmojiPlayback = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string | null;
  targetSeatIndex: number;
  targetUserId?: string | null;
  targetName?: string | null;
  emoji: string;
  url: string | null;
  clipPath: string | null;
};

function findSeat(index: number) {
  return document.querySelector<HTMLElement>(`[data-seat-index="${index}"]`);
}

function avatarRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  const candidate = element.querySelector<HTMLElement>("[data-avatar], img:not([aria-hidden=\"true\"]), video") ?? element;
  const rect = candidate.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function findUserSeat(userId: string | null | undefined) {
  if (!userId) return null;
  const seats = Array.from(document.querySelectorAll<HTMLElement>("[data-seat-index]"));
  return seats.find((seat) => seat.getAttribute("data-user-dp") === userId) ?? null;
}

/**
 * Voice-room emojis are seat reactions. They fly from the sender's occupied
 * seat to the selected recipient seat and finish on the recipient avatar.
 */
export function playVoiceRoomEmojiAtSeat(payload: Pick<VoiceRoomEmojiPlayback, "targetSeatIndex" | "emoji" | "url" | "clipPath" | "senderName" | "targetName"> & { senderId?: string | null }) {
  if (typeof document === "undefined") return;
  const startedAt = performance.now();

  const attempt = () => {
    const targetSeat = findSeat(payload.targetSeatIndex);
    const targetRect = avatarRect(targetSeat);
    if (!targetRect) {
      if (performance.now() - startedAt < 4000) window.requestAnimationFrame(attempt);
      return;
    }

    const senderRect = avatarRect(findUserSeat(payload.senderId));
    const startX = senderRect ? senderRect.left + senderRect.width / 2 : targetRect.left + targetRect.width / 2;
    const startY = senderRect ? senderRect.top + senderRect.height / 2 : targetRect.top + targetRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    const size = Math.max(38, Math.min(68, Math.min(targetRect.width, targetRect.height) * 0.9));
    const layer = document.createElement("div");
    Object.assign(layer.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: `${size}px`,
      height: `${size}px`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
      zIndex: "2147483647",
      pointerEvents: "none",
      display: "grid",
      placeItems: "center",
      overflow: "visible",
      transform: `translate3d(${startX}px, ${startY}px, 0) scale(.55)`,
      opacity: "0",
      willChange: "transform, opacity",
    });
    layer.dataset.jalwaSeatEmoji = "true";

    const node = document.createElement("div");
    Object.assign(node.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      display: "grid",
      placeItems: "center",
      fontSize: `${Math.max(28, Math.min(52, size * 0.8))}px`,
      lineHeight: "1",
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
      img.onerror = () => { img.style.display = "none"; };
      node.appendChild(img);
    }

    layer.appendChild(node);
    document.body.appendChild(layer);

    const routeLabel = document.createElement("div");
    routeLabel.textContent = payload.targetName
      ? `${payload.senderName ?? "User"} → ${payload.targetName}`
      : payload.senderName ?? "User";
    Object.assign(routeLabel.style, {
      position: "absolute",
      left: "50%",
      top: "100%",
      transform: "translateX(-50%)",
      marginTop: "4px",
      maxWidth: "150px",
      padding: "3px 7px",
      borderRadius: "999px",
      background: "rgba(0,0,0,.78)",
      color: "#fff",
      fontSize: "10px",
      fontWeight: "800",
      lineHeight: "1.1",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      textAlign: "center",
      boxShadow: "0 2px 10px rgba(0,0,0,.35)",
    });
    node.appendChild(routeLabel);

    const travelX = endX - startX;
    const travelY = endY - startY;
    let animation: Animation | null = null;
    try {
      animation = layer.animate(
        [
          { transform: `translate3d(${startX}px, ${startY}px, 0) scale(.55)`, opacity: 0 },
          { transform: `translate3d(${startX + travelX * .18}px, ${startY + travelY * .18 - 18}px, 0) scale(1.05)`, opacity: 1, offset: .18 },
          { transform: `translate3d(${startX + travelX * .62}px, ${startY + travelY * .62 + 8}px, 0) scale(.94)`, opacity: 1, offset: .62 },
          { transform: `translate3d(${endX}px, ${endY}px, 0) scale(1.16)`, opacity: 1, offset: .82 },
          { transform: `translate3d(${endX}px, ${endY}px, 0) scale(1.06)`, opacity: 1, offset: .92 },
          { transform: `translate3d(${endX}px, ${endY}px, 0) scale(.88)`, opacity: 0 },
        ],
        { duration: 1800, easing: "cubic-bezier(.22,.72,.22,1)", fill: "forwards" },
      );
    } catch {
      layer.style.transform = `translate3d(${endX}px, ${endY}px, 0) scale(1)`;
      layer.style.opacity = "1";
    }

    window.setTimeout(() => {
      animation?.cancel();
      layer.remove();
    }, 1950);
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
