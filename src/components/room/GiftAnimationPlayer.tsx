import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";

type Props = { roomId: string };

/**
 * Room-level playback entry point. Broadcast is the fast playback plane;
 * gift_sends Postgres INSERT remains the durable/recovery plane handled by
 * StableGiftAnimationPlayer.
 */
export function GiftAnimationPlayer({ roomId }: Props) {
  useEffect(() => {
    let alive = true;
    const channel = supabase
      .channel(`gift-player-${roomId}`)
      .on("broadcast", { event: "gift_play" }, ({ payload }) => {
        if (!alive || !payload || typeof payload !== "object") return;
        const p = payload as Record<string, unknown>;
        if (p.roomId !== roomId || typeof p.id !== "string" || typeof p.giftId !== "string") return;
        window.dispatchEvent(
          new CustomEvent("jalwa:gift-sent", {
            detail: {
              key: p.id,
              senderId: typeof p.senderId === "string" ? p.senderId : null,
              senderName: typeof p.senderName === "string" ? p.senderName : "User",
              senderAvatar: typeof p.senderAvatar === "string" ? p.senderAvatar : null,
              receiverId: typeof p.receiverId === "string" ? p.receiverId : null,
              receiverIds: Array.isArray(p.receiverIds) ? p.receiverIds.filter((x): x is string => typeof x === "string") : [],
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
      })
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return <StableGiftAnimationPlayer roomId={roomId} />;
}
