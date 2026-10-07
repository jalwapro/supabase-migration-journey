import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireGiftBroadcastChannel, releaseGiftBroadcastChannel } from "@/lib/giftBroadcast";
import { preloadGiftAssets } from "@/lib/giftMedia";
import { supabase } from "@/integrations/supabase/client";
import { ReliableGiftAnimationPlayer } from "./ReliableGiftAnimationPlayer";
import { useAuth } from "@/hooks/useAuth";

type Props = { roomId: string };

export function GiftAnimationPlayer({ roomId }: Props) {
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("get_top_sent_gifts", { limit_n: 10 }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return;
      for (const gift of data.slice(0, 10)) {
        if (!gift || typeof gift !== "object") continue;
        preloadGiftAssets(gift as { clip_path?: string | null; image_url?: string | null; sound_url?: string | null; emoji?: string | null });
      }
    });
    return () => { cancelled = true; };
  }, []);
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
        audioEnabled: p.giftAudioEnabled !== false,
        audioVolume: typeof p.giftAudioVolume === "number" ? p.giftAudioVolume : 1,
        quantity: typeof p.quantity === "number" ? p.quantity : 1,
        renderConfig: p.renderConfig && typeof p.renderConfig === "object" ? p.renderConfig as Record<string, unknown> : null,
        local: true,
        broadcast: true,
      };

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

  return <ReliableGiftAnimationPlayer roomId={roomId} />;
}
