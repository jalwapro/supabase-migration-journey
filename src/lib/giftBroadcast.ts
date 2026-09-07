import { supabase } from "@/integrations/supabase/client";
import type { Gift } from "@/components/GiftSheet";

export type GiftBroadcastPayload = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  senderAvatar?: string | null;
  receiverId: string | null;
  receiverIds: string[];
  receiverName?: string | null;
  giftId: string;
  giftName: string;
  giftEmoji?: string | null;
  giftIcon?: string | null;
  giftImageUrl?: string | null;
  giftClipPath?: string | null;
  giftClipType?: string | null;
  giftDurationMs?: number | null;
  giftAudioUrl?: string | null;
  giftSoundUrl?: string | null;
  giftLoop?: boolean | null;
  quantity: number;
  renderConfig?: Record<string, unknown> | null;
};

/**
 * Low-latency room gift fan-out. The database RPC remains authoritative for
 * coins/history; this broadcast is only the playback signal and its immutable
 * render snapshot. Sending before SUBSCRIBED intentionally falls back to the
 * Realtime HTTP transport, avoiding a second connection setup delay.
 */
export async function broadcastGiftPlayback(
  roomId: string,
  gift: Gift,
  targets: string[],
  sender: { id: string | null; name: string; avatar?: string | null },
  quantity: number,
  id = crypto.randomUUID(),
): Promise<void> {
  const channel = supabase.channel(`gift-player-${roomId}`);
  const payload: GiftBroadcastPayload = {
    id,
    roomId,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar ?? null,
    receiverId: targets[0] ?? null,
    receiverIds: targets,
    receiverName: null,
    giftId: gift.id,
    giftName: gift.name,
    giftEmoji: gift.emoji ?? null,
    giftIcon: gift.icon ?? null,
    giftImageUrl: gift.image_url ?? null,
    giftClipPath: gift.clip_path ?? null,
    giftClipType: gift.clip_type ?? null,
    giftDurationMs: (gift as Gift & { duration_ms?: number | null }).duration_ms ?? null,
    giftAudioUrl: gift.sound_url ?? null,
    giftSoundUrl: gift.sound_url ?? null,
    giftLoop: (gift as Gift & { loop?: boolean | null }).loop ?? null,
    quantity,
    renderConfig: (gift.render_config as Record<string, unknown> | null) ?? null,
  };

  try {
    await channel.send({ type: "broadcast", event: "gift_play", payload });
  } finally {
    await supabase.removeChannel(channel);
  }
}
