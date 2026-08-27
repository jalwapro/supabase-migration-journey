import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";

/**
 * Realtime room entrance stream with a FIFO playback queue.
 * The realtime subscription is established before firing the local entrance,
 * so every connected client can receive the INSERT and the joining client can
 * still play it immediately from the RPC response without duplicating it.
 */
export function useRoomEntrances(roomId: string | null | undefined, localUserId: string | null | undefined) {
  const [current, setCurrent] = useState<RoomEntranceEvent | null>(null);
  const queueRef = useRef<RoomEntranceEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    let entranceFired = false;

    const enqueue = (row: RoomEntranceEvent | null | undefined) => {
      if (cancelled || !mountedRef.current || !row?.id) return;
      if (seenRef.current.has(row.id)) return;
      const created = new Date(row.created_at).getTime();
      const age = Number.isFinite(created) ? Date.now() - created : 0;
      if (age > 30000) return;
      seenRef.current.add(row.id);
      queueRef.current.push(row);
      pump();
    };

    const fireLocalEntrance = async () => {
      if (entranceFired || !localUserId || cancelled) return;
      entranceFired = true;
      const { data } = await supabase.rpc("fire_room_entrance", { _room_id: roomId });
      if (cancelled) return;
      const row = (data as { event?: RoomEntranceEvent } | null)?.event;
      enqueue(row);
    };

    const channel = supabase
      .channel(`room-entrances-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_entrances",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => enqueue(payload.new as RoomEntranceEvent),
      )
      .subscribe((status) => {
        // Do not fire the local entrance until this client is actually
        // subscribed. This removes the race where the RPC INSERT happened
        // before the postgres_changes listener existed.
        if (status === "SUBSCRIBED") void fireLocalEntrance();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };

    function pump() {
      if (cancelled || !mountedRef.current) return;
      setCurrent((existing) => existing ?? queueRef.current.shift() ?? null);
    }
  }, [roomId, localUserId]);

  const done = () => {
    setCurrent(null);
    window.setTimeout(() => {
      setCurrent((existing) => existing ?? queueRef.current.shift() ?? null);
    }, 150);
  };

  return { current, done };
}
