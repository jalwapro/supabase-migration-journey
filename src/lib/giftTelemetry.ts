// Lightweight, batched gift playback telemetry. Never blocks or throws into
// the render path — failures are swallowed so a telemetry outage can never
// break gift playback.
import { supabase } from "@/integrations/supabase/client";

export type PlaybackStatus = "delivered" | "played" | "failed" | "skipped";

export type PlaybackSample = {
  roomId?: string | null;
  giftId?: string | null;
  eventKey?: string | null;
  status: PlaybackStatus;
  queueWaitMs?: number | null;
  playbackMs?: number | null;
  fetchMs?: number | null;
  error?: string | null;
};

type Row = {
  room_id: string | null;
  gift_id: string | null;
  user_id: string | null;
  event_key: string | null;
  status: PlaybackStatus;
  queue_wait_ms: number | null;
  playback_ms: number | null;
  fetch_ms: number | null;
  error: string | null;
};

const buffer: Row[] = [];
const MAX_BUFFER = 40;
const FLUSH_MS = 8000;
let timer: ReturnType<typeof setTimeout> | null = null;
let cachedUserId: string | null | undefined;

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function currentUserId() {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

async function flush() {
  timer = null;
  if (!buffer.length) return;
  const rows = buffer.splice(0, buffer.length);
  const userId = await currentUserId();
  if (!userId) return; // anonymous viewers don't report
  try {
    await supabase
      .from("gift_playback_events")
      .insert(rows.map((r) => ({ ...r, user_id: userId })));
  } catch {
    /* telemetry is best-effort */
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => void flush(), FLUSH_MS);
}

export function trackGiftPlayback(sample: PlaybackSample) {
  try {
    buffer.push({
      room_id: isUuid(sample.roomId) ? sample.roomId! : null,
      gift_id: isUuid(sample.giftId) ? sample.giftId! : null,
      user_id: null,
      event_key: sample.eventKey ? sample.eventKey.slice(0, 120) : null,
      status: sample.status,
      queue_wait_ms: sample.queueWaitMs ?? null,
      playback_ms: sample.playbackMs ?? null,
      fetch_ms: sample.fetchMs ?? null,
      error: sample.error ? String(sample.error).slice(0, 400) : null,
    });
    if (buffer.length >= MAX_BUFFER) void flush();
    else schedule();
  } catch {
    /* noop */
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => void flush());
}
