import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";

/**
 * Subscribes to room_entrances realtime for a specific room and returns a
 * single-slot playback queue. Only one entrance renders at a time; extras
 * are dropped after 30s. Also fires the entrance for the local user once on
 * mount (via fire_room_entrance RPC).
 */
export function useRoomEntrances(roomId: string | null | undefined, localUserId: string | null | undefined) {
  const [current, setCurrent] = useState<RoomEntranceEvent | null>(null);
  const queueRef = useRef<RoomEntranceEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // Fire the local user's entrance
  useEffect(() => {
    if (!roomId || !localUserId) return;
    void supabase.rpc("fire_room_entrance", { _room_id: roomId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, localUserId]);

  // Subscribe to realtime
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-entrances-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_entrances", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as RoomEntranceEvent;
          if (!row?.id || seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          // Skip stale events (>15s old)
          const age = Date.now() - new Date(row.created_at).getTime();
          if (age > 15000) return;
          queueRef.current.push(row);
          pump();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function pump() {
    setCurrent((existing) => {
      if (existing) return existing;
      return queueRef.current.shift() ?? null;
    });
  }

  function done() {
    setCurrent(null);
    setTimeout(pump, 150);
  }

  return { current, done };
}
