import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomEntranceEvent } from "@/lib/entrance/registry";

/** Reliable room entrance stream: durable Postgres Changes + immediate Broadcast. */
export function useRoomEntrances(roomId: string | null | undefined, localUserId: string | null | undefined) {
  const [current, setCurrent] = useState<RoomEntranceEvent | null>(null);
  const queueRef = useRef<RoomEntranceEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let entranceFired = false;
    queueRef.current = [];
    seenRef.current = new Set();

    const pump = () => {
      if (cancelled || !mountedRef.current) return;
      setCurrent(existing => existing ?? queueRef.current.shift() ?? null);
    };
    const enqueue = (row: RoomEntranceEvent | null | undefined) => {
      if (cancelled || !mountedRef.current || !row?.id) return;
      if (row.room_id !== roomId || seenRef.current.has(row.id)) return;
      const age = Date.now() - new Date(row.created_at).getTime();
      if (Number.isFinite(age) && age > 30000) return;
      seenRef.current.add(row.id);
      queueRef.current.push(row);
      pump();
    };

    const channel = supabase.channel(`room-entrances-${roomId}`, { config: { broadcast: { self: true } } });
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_entrances", filter: `room_id=eq.${roomId}` }, payload => enqueue(payload.new as RoomEntranceEvent))
      .on("broadcast", { event: "room-entrance" }, ({ payload }) => enqueue(payload as RoomEntranceEvent))
      .subscribe(async status => {
        if (status !== "SUBSCRIBED" || entranceFired || !localUserId || cancelled) return;
        entranceFired = true;
        const { data, error } = await supabase.rpc("fire_room_entrance", { _room_id: roomId });
        if (cancelled || error) return;
        const row = (data as { event?: RoomEntranceEvent } | null)?.event;
        if (!row) return;
        enqueue(row);
        await channel.send({ type: "broadcast", event: "room-entrance", payload: row });
      });

    return () => { cancelled = true; queueRef.current = []; void supabase.removeChannel(channel); };
  }, [roomId, localUserId]);

  const done = () => {
    setCurrent(null);
    window.setTimeout(() => setCurrent(existing => existing ?? queueRef.current.shift() ?? null), 150);
  };
  return { current, done };
}
