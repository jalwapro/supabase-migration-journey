import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";

type CpBroadcast = {
  id: string;
  broadcast_type: "new_cp" | "level_up" | "anniversary";
  user1_name: string;
  user2_name: string;
  ring_name?: string | null;
  message: string;
};

export function CpGlobalMarquee() {
  const [current, setCurrent] = useState<CpBroadcast | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel("cp-global-broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cp_broadcasts" },
        (payload) => {
          if (!active) return;
          const row = payload.new as CpBroadcast;
          if (!row?.id || !row.message) return;
          setCurrent(row);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => {
            if (active) setCurrent((shown) => shown?.id === row.id ? null : shown);
            hideTimer.current = null;
          }, 8500);
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (!current) return null;

  const announcementLabel = current.broadcast_type === "level_up"
    ? "CP LEVEL UP"
    : current.broadcast_type === "anniversary"
      ? "CP ANNIVERSARY"
      : "NEW CP COUPLE";

  return (
    <aside aria-label="Global CP Announcement" role="status" aria-live="polite" className="pointer-events-none fixed left-1/2 top-16 z-[150] w-[92%] max-w-lg -translate-x-1/2 animate-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-pink-400/50 bg-gradient-to-r from-pink-900/95 via-purple-900/95 to-rose-950/95 p-3.5 shadow-2xl shadow-pink-500/30 backdrop-blur-md">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-500/20 text-xl">💍</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-pink-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-pink-200">{announcementLabel}</span>
              <span className="text-[11px] font-bold text-amber-300">{current.ring_name || "Forever Ring"}</span>
            </div>
            <p className="mt-0.5 truncate text-xs font-bold text-white">{current.message}</p>
          </div>
          <Heart aria-hidden="true" className="h-5 w-5 shrink-0 animate-bounce text-pink-400" />
        </div>
      </div>
    </aside>
  );
}
