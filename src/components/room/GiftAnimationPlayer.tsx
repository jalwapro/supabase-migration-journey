import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireGiftBroadcastChannel, releaseGiftBroadcastChannel } from "@/lib/giftBroadcast";
import { StableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";

type Props = { roomId: string };

export function GiftAnimationPlayer({ roomId }: Props) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let alive = true;
    const channel = acquireGiftBroadcastChannel(roomId);
    const subscription = channel.on("broadcast", { event: "gift_play" }, ({ payload }) => {
      if (!alive || !payload || typeof payload !== "object") return;
      const p = payload as Record<string, unknown>;
      if (p.roomId !== roomId || typeof p.id !== "string" || typeof p.giftId !== "string") return;

      const receiverIds = Array.isArray(p.receiverIds)
        ? p.receiverIds.filter((x): x is string => typeof x === "string")
        : typeof p.receiverId === "string"
          ? [p.receiverId]
          : [];

      // The gift_sends row is the durable source of truth. Broadcast is the
      // low-latency UI signal, so invalidate affected caches when it arrives.
      // Prefix invalidation intentionally covers profile/profile-id variants.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["gifts-received"] }),
        queryClient.invalidateQueries({ queryKey: ["gifts-sent"] }),
        ...receiverIds.map((receiverId) =>
          queryClient.invalidateQueries({ queryKey: ["host-popularity", receiverId] }),
        ),
      ]);

      window.dispatchEvent(
        new CustomEvent("jalwa:gift-sent", {
          detail: {
            key: p.id,
            eventIds: Array.isArray(p.eventIds) ? p.eventIds.filter((x): x is string => typeof x === "string") : [p.id],
            senderId: typeof p.senderId === "string" ? p.senderId : null,
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
          },
        }),
      );
    });
    void subscription;
    return () => {
      alive = false;
      releaseGiftBroadcastChannel(roomId);
    };
  }, [roomId, queryClient]);

  return <StableGiftAnimationPlayer roomId={roomId} />;
}
