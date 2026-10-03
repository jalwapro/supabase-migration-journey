import { useEffect, useRef } from "react";
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
  const lastReconcileAt = useRef(0);
  useEffect(() => {
    if (!subs.length) return;
    let ch = supabase.channel(channelName);
    const pendingKeys = new Map<string, string | (string | number | null | undefined)[]>();
    let flushTimer: number | null = null;
    const queueInvalidate = (keys: (string | (string | number | null | undefined))[], refetchType: "active" | "none" = "active") => {
      for (const key of keys) pendingKeys.set(JSON.stringify(key), key);
      if (flushTimer !== null) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        const keys = [...pendingKeys.values()];
        pendingKeys.clear();
        for (const key of keys) qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key], refetchType });
      }, 75);
    };
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

        () => queueInvalidate(s.invalidate),
      );
    }
    ch.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        queueInvalidate(subs.flatMap((s) => s.invalidate));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn("[Realtime]", channelName, status, error);
      }
    });

    const reconcile = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastReconcileAt.current < 15_000) return;
      lastReconcileAt.current = now;
      queueInvalidate(subs.flatMap((s) => s.invalidate));
    };
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      void supabase.removeChannel(ch);
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      pendingKeys.clear();
      window.removeEventListener("online", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subs)]);
}
