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

type GiftChannel = ReturnType<typeof supabase.channel>;
type ChannelEntry = { channel: GiftChannel; refs: number; ready: Promise<void> };

const channels = new Map<string, ChannelEntry>();

/** Acquire the room-scoped gift channel. The room player owns the lifetime. */
export function acquireGiftBroadcastChannel(roomId: string): GiftChannel {
  const existing = channels.get(roomId);
  if (existing) {
    existing.refs += 1;
    return existing.channel;
  }

  const channel = supabase.channel(`gift-player-${roomId}`, {
    config: {
      private: false,
      broadcast: { self: true, ack: true },
    },
  });
  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error(`Gift channel ${status}`));
    });
  });

  channels.set(roomId, { channel, refs: 1, ready });
  return channel;
}

/** Release one room-scoped gift channel reference. */
export function releaseGiftBroadcastChannel(roomId: string): void {
  const entry = channels.get(roomId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  channels.delete(roomId);
  void supabase.removeChannel(entry.channel);
}

/**
 * Low-latency room gift fan-out. The database RPC remains authoritative for
 * coins/history. `id` MUST be the gift_sends.id returned by the RPC so the
 * local Broadcast and durable Postgres event share one canonical dedupe key.
 */
export async function broadcastGiftPlayback(
  roomId: string,
  gift: Gift,
  targets: string[],
  sender: { id: string | null; name: string; avatar?: string | null },
  quantity: number,
  id: string,
): Promise<void> {
  if (!id) throw new Error("Gift broadcast requires the canonical gift_sends.id");

  let entry = channels.get(roomId);
  if (!entry) {
    acquireGiftBroadcastChannel(roomId);
    entry = channels.get(roomId);
  }
  if (!entry) throw new Error("Unable to initialize gift broadcast channel");

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

  await entry.ready;
  const result = await entry.channel.send({ type: "broadcast", event: "gift_play", payload });
  if (result !== "ok") throw new Error("Gift broadcast was not acknowledged by Realtime");
}
