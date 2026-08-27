import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";

/**
 * Reliable room entrance stream.
 * Uses both Postgres Changes and Supabase Broadcast. Postgres Changes remains
 * the durable source of truth; Broadcast removes delivery gaps when realtime
 * replication is delayed or a client joins while an INSERT is being emitted.
 */
export function useRoomEntrances(roomId: string | null | undefined, localUserId: string | null | undefined) {
  const [current, setCurrent] = useState<RoomEntranceEvent | null>(null);
  const queueRef = useRef<RoomEntranceEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let entranceFired = false;

    const pump = () => {
      if (cancelled || !mountedRef.current) return;
      setCurrent(existing => existing ?? queueRef.current.shift() ?? null);
    };

    const enqueue = (row: RoomEntranceEvent | null | undefined) => {
      if (cancelled || !mountedRef.current || !row?.id) return;
      if (seenRef.current.has(row.id)) return;
      if (row.room_id && row.room_id !== roomId) return;
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
      const { data, error } = await supabase.rpc("fire_room_entrance", { _room_id: roomId });
      if (cancelled || error) return;
      const row = (data as { event?: RoomEntranceEvent } | null)?.event;
      if (!row) return;

      // Durable delivery through postgres_changes.
      enqueue(row);
      // Immediate delivery through Broadcast to every already-connected room client.
      await channel.send({
        type: "broadcast",
        event: "room-entrance",
        payload: row,
      });
    };

    const channel = supabase
      .channel(`room-entrances-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_entrances", filter: `room_id=eq.${roomId}` },
        payload => enqueue(payload.new as RoomEntranceEvent),
      )
      .on("broadcast", { event: "room-entrance" }, ({ payload }) => {
        enqueue(payload as RoomEntranceEvent);
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") void fireLocalEntrance();
      });

    return () => {
      cancelled = true;
      queueRef.current = [];
      supabase.removeChannel(channel);
    };
  }, [roomId, localUserId]);

  const done = () => {
    setCurrent(null);
    window.setTimeout(() => {
      setCurrent(existing => existing ?? queueRef.current.shift() ?? null);
    }, 150);
  };

  return { current, done };
}
