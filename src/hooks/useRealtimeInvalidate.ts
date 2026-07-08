import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Sub = {
  /** table name in public schema */
  table: string;
  /** optional postgres filter like `host_id=eq.<uid>` */
  filter?: string;
  /** query keys to invalidate on any change */
  invalidate: (string | (string | number | null | undefined)[])[];
};

/**
 * Subscribe to Postgres change events for one or more tables and invalidate
 * the given React Query keys whenever a row inserts/updates/deletes.
 * Use this to keep any list view live without polling.
 */
export function useRealtimeInvalidate(channelName: string, subs: Sub[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!subs.length) return;
    let ch = supabase.channel(channelName);
    for (const s of subs) {
      ch = (ch as unknown as {
        on: (
          type: string,
          cfg: Record<string, unknown>,
          cb: () => void,
        ) => typeof ch;
      }).on(
        "postgres_changes",
        { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },

        () => {
          for (const key of s.invalidate) {
            qc.invalidateQueries({
              queryKey: Array.isArray(key) ? key : [key],
            });
          }
        },
      );
    }
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subs)]);
}
