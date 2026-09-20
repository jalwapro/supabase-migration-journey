import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireGiftBroadcastChannel, releaseGiftBroadcastChannel } from "@/lib/giftBroadcast";
import { useAuth } from "@/hooks/useAuth";

type Props = { roomId: string };

export function GiftAnimationPlayer({ roomId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const processedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const channel = acquireGiftBroadcastChannel(roomId);

    const subscription = channel.on("broadcast", { event: "gift_play" }, ({ payload }) => {
      if (!alive || !payload || typeof payload !== "object") return;
      const p = payload as Record<string, unknown>;
      const eventKey = typeof p.id === "string" ? p.id : null;
      if (!eventKey || p.roomId !== roomId || typeof p.giftId !== "string") return;
      if (processedEventsRef.current.has(eventKey)) return;
      processedEventsRef.current.add(eventKey);
      window.setTimeout(() => processedEventsRef.current.delete(eventKey), 5000);

      const senderId = typeof p.senderId === "string" ? p.senderId : null;
      const receiverIds = Array.isArray(p.receiverIds)
        ? p.receiverIds.filter((x): x is string => typeof x === "string")
        : typeof p.receiverId === "string" ? [p.receiverId] : [];
      const isSenderOrReceiver = !!user?.id && (user.id === senderId || receiverIds.includes(user.id));

      if (isSenderOrReceiver) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: ["wallet"] }),
          queryClient.invalidateQueries({ queryKey: ["gifts-received"] }),
          queryClient.invalidateQueries({ queryKey: ["gifts-sent"] }),
          ...receiverIds.map(rid => queryClient.invalidateQueries({ queryKey: ["host-popularity", rid] })),
        ]);
      }

      // Playback is rendered by StableGiftAnimationPlayer from the durable gift_sends row.
      // Keep this channel only for fast wallet/profile invalidation; do not create
      // a second renderer here, otherwise one gift can animate twice.
    });

    void subscription;
    return () => {
      alive = false;
      releaseGiftBroadcastChannel(roomId);
    };
  }, [roomId, queryClient, user?.id]);

  return null;
}
