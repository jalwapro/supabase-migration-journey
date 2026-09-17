import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireGiftBroadcastChannel, releaseGiftBroadcastChannel } from "@/lib/giftBroadcast";
import { StableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";
import { useAuth } from "@/hooks/useAuth";

type Props = { roomId: string };

export function GiftAnimationPlayer({ roomId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Ref to prevent duplicate firing of the same animation key on re-renders
  const processedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const channel = acquireGiftBroadcastChannel(roomId);
    
    const subscription = channel.on("broadcast", { event: "gift_play" }, ({ payload }) => {
      if (!alive || !payload || typeof payload !== "object") return;
      const p = payload as Record<string, unknown>;
      
      const eventKey = typeof p.id === "string" ? p.id : null;
      if (!eventKey || p.roomId !== roomId || typeof p.giftId !== "string") return;

      // Prevent duplicate rendering if already processed in last 5 seconds
      if (processedEventsRef.current.has(eventKey)) return;
      processedEventsRef.current.add(eventKey);
      setTimeout(() => processedEventsRef.current.delete(eventKey), 5000);

      const senderId = typeof p.senderId === "string" ? p.senderId : null;
      const receiverIds = Array.isArray(p.receiverIds)
        ? p.receiverIds.filter((x): x is string => typeof x === "string")
        : typeof p.receiverId === "string"
          ? [p.receiverId]
          : [];

      const isSenderOrReceiver = !!user?.id && (user.id === senderId || receiverIds.includes(user.id));

      // Optimize queries only for the active participants to save memory & bandwidth
      if (isSenderOrReceiver) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: ["wallet"] }),
          queryClient.invalidateQueries({ queryKey: ["gifts-received"] }),
          queryClient.invalidateQueries({ queryKey: ["gifts-sent"] }),
          ...receiverIds.map(rid => queryClient.invalidateQueries({ queryKey: ["host-popularity", rid] }))
        ]);
      }

      // 🌟 Direct DOM CustomEvent Dispatch with Fallback Render Queue
      const giftDetail = {
        key: eventKey,
        eventIds: Array.isArray(p.eventIds) ? p.eventIds.filter((x): x is string => typeof x === "string") : [eventKey],
        senderId,
        senderName: typeof p.senderName === "string" ? p.senderName : "User",
        senderAvatar: typeof p.senderAvatar === "string" ? p.senderAvatar : null,
        receiverId: typeof p.receiverId === "string" ? p.receiverId : null,
        receiverIds,
        receiverName: typeof p.receiverName === "string" ? p.receiverName : null,
        giftId: p.giftId,
        giftName: typeof p.giftName === "string" ? p.giftName : "Gift",
        giftEmoji: typeof p.giftEmoji === "string" ? p.giftEmoji : "🎁",
        giftIcon: typeof p.giftIcon === "string" ? p.giftIcon : null,
        giftImageUrl: typeof p.giftImageUrl === "string" ? p.giftImageUrl : null,
        giftClipUrl: typeof p.giftClipPath === "string" ? p.giftClipPath : null,
        giftClipType: typeof p.giftClipType === "string" ? p.giftClipType : null,
        durationMs: typeof p.giftDurationMs === "number" ? p.giftDurationMs : null,
        soundUrl: typeof p.giftSoundUrl === "string" ? p.giftSoundUrl : (typeof p.giftAudioUrl === "string" ? p.giftAudioUrl : null),
        quantity: typeof p.quantity === "number" ? p.quantity : 1,
        renderConfig: p.renderConfig && typeof p.renderConfig === "object" ? p.renderConfig : null,
        local: true,
        broadcast: true,
      };

      // Ensure execution happens smoothly on next animation frame for zero UI stutter
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("jalwa:gift-sent", { detail: giftDetail }));
      });
    });

    void subscription;

    return () => {
      alive = false;
      releaseGiftBroadcastChannel(roomId);
    };
  }, [roomId, queryClient, user?.id]);

  return <StableGiftAnimationPlayer roomId={roomId} />;
}
