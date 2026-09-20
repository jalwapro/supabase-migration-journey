import { supabase } from "@/integrations/supabase/client";
import type { Gift } from "@/components/GiftSheet";
import { resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";

export type GiftBroadcastPayload = {
  id: string;
  eventIds?: string[];
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
  giftAudioEnabled?: boolean | null;
  giftAudioVolume?: number | null;
  giftLoop?: boolean | null;
  quantity: number;
  renderConfig?: Record<string, unknown> | null;
};

type GiftChannel = ReturnType<typeof supabase.channel>;
type ChannelEntry = { channel: GiftChannel; refs: number; ready: Promise<void> };

const channels = new Map<string, ChannelEntry>();

export function acquireGiftBroadcastChannel(roomId: string): GiftChannel {
  const existing = channels.get(roomId);
  if (existing) {
    existing.refs += 1;
    return existing.channel;
  }
  const channel = supabase.channel(`gift-player-${roomId}`, { config: { private: false, broadcast: { self: true, ack: true } } });
  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error(`Gift channel ${status}`));
    });
  });
  channels.set(roomId, { channel, refs: 1, ready });
  return channel;
}

export function releaseGiftBroadcastChannel(roomId: string): void {
  const entry = channels.get(roomId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  channels.delete(roomId);
  void supabase.removeChannel(entry.channel);
}

export async function broadcastGiftPlayback(
  roomId: string,
  gift: Gift,
  targets: string[],
  sender: { id: string | null; name: string; avatar?: string | null },
  quantity: number,
  id: string,
  eventIds: string[] = [id],
): Promise<void> {
  if (!id) throw new Error("Gift broadcast requires the canonical gift_sends.id");
  let entry = channels.get(roomId);
  if (!entry) {
    acquireGiftBroadcastChannel(roomId);
    entry = channels.get(roomId);
  }
  if (!entry) throw new Error("Unable to initialize gift broadcast channel");

  const audioEnabled = gift.audio_enabled !== false;
  const rawVolume = Number(gift.audio_volume ?? 1);
  const audioVolume = Number.isFinite(rawVolume) ? Math.min(1, Math.max(0, rawVolume)) : 1;
  const soundUrl = resolvePlayableGiftUrl(gift.sound_url);

  const payload: GiftBroadcastPayload = {
    id,
    eventIds: [...new Set(eventIds.filter(Boolean))],
    roomId,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar ?? null,
    receiverId: targets[0] ?? null,
    receiverIds: [...new Set(targets.filter(Boolean))],
    receiverName: null,
    giftId: gift.id,
    giftName: gift.name,
    giftEmoji: gift.emoji ?? null,
    giftIcon: resolveGiftImageUrl(gift.icon) ?? gift.icon ?? null,
    giftImageUrl: resolveGiftImageUrl(gift.image_url),
    giftClipPath: resolvePlayableGiftUrl(gift.clip_path),
    giftClipType: gift.clip_type ?? null,
    giftDurationMs: (gift as Gift & { duration_ms?: number | null }).duration_ms ?? null,
    giftAudioUrl: soundUrl,
    giftSoundUrl: soundUrl,
    giftAudioEnabled: audioEnabled,
    giftAudioVolume: audioVolume,
    giftLoop: (gift as Gift & { loop?: boolean | null }).loop ?? null,
    quantity,
    renderConfig: (gift.render_config as Record<string, unknown> | null) ?? null,
  };

  // Realtime broadcast is an optional delivery path. The canonical gift_sends
  // row is already durable, and room players also consume that row through
  // postgres_changes. Never fail a paid gift just because Realtime is slow,
  // disconnected, or the broadcast ACK times out.
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("jalwa:gift-sent", {
        detail: {
          key: payload.id,
          eventIds: payload.eventIds,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          receiverId: payload.receiverId,
          receiverIds: payload.receiverIds,
          receiverName: payload.receiverName,
          giftId: payload.giftId,
          giftName: payload.giftName,
          giftEmoji: payload.giftEmoji,
          giftIcon: payload.giftIcon,
          giftImageUrl: payload.giftImageUrl,
          giftClipUrl: payload.giftClipPath,
          giftClipType: payload.giftClipType,
          durationMs: payload.giftDurationMs,
          soundUrl: payload.giftSoundUrl ?? payload.giftAudioUrl,
          audioEnabled: payload.giftAudioEnabled,
          audioVolume: payload.giftAudioVolume,
          quantity: payload.quantity,
          renderConfig: payload.renderConfig,
          local: true,
          broadcast: true,
        },
      }));
    });
  }

  try {
    await entry.ready;
    const result = await entry.channel.send({ type: "broadcast", event: "gift_play", payload });
    if (result !== "ok") {
      console.warn("[gift] realtime broadcast not acknowledged:", result);
    }
  } catch (error) {
    console.warn("[gift] realtime broadcast unavailable; durable gift send remains valid:", error);
    // Drop a failed channel so the next gift can create a fresh subscription.
    const current = channels.get(roomId);
    if (current?.channel === entry.channel) {
      channels.delete(roomId);
      void supabase.removeChannel(entry.channel);
    }
  }
}
