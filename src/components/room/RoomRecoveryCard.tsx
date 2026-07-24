import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Radio, LogIn, XCircle } from "lucide-react";
import { toast } from "sonner";

type Recoverable = {
  id: string;
  title: string | null;
  cover_url: string | null;
  room_type: "voice" | "video" | string;
  status: "live" | "host_disconnected" | string;
  grace_period_until: string | null;
  viewer_count: number | null;
};

function fmtLeft(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

/**
 * Sticky priority card shown on Home when the signed-in user has a room
 * that is either still live (they abruptly navigated away) or currently
 * in the 20-minute host_disconnected grace window.
 */
export function RoomRecoveryCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "reenter" | "end">(null);
  const [tick, setTick] = useState(() => Date.now());

  const q = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-recoverable-room", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_recoverable_room");
      if (error) throw error;
      return (Array.isArray(data) && data.length ? (data[0] as Recoverable) : null);
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!q.data || q.data.status !== "host_disconnected") return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [q.data]);

  if (!user || !q.data) return null;
  const room = q.data;
  const graceMs = room.grace_period_until
    ? Math.max(0, new Date(room.grace_period_until).getTime() - tick)
    : 0;
  const inGrace = room.status === "host_disconnected";

  async function reenter() {
    setBusy("reenter");
    try {
      if (inGrace) {
        const { error } = await supabase.rpc("reclaim_room", { _room_id: room.id });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["my-recoverable-room"] });
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function endNow() {
    if (!confirm("End this room now? Gifts will be finalized.")) return;
    setBusy("end");
    try {
      const { error } = await supabase.rpc("end_room", { _room_id: room.id });
      if (error) throw error;
      toast.success("Room ended");
      await qc.invalidateQueries({ queryKey: ["my-recoverable-room"] });
      await qc.invalidateQueries({ queryKey: ["home-rooms"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="px-4 pt-3">
      <div
        className={`relative overflow-hidden rounded-2xl border p-3 shadow-lg backdrop-blur ${
          inGrace
            ? "border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15"
            : "border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/40">
            {room.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={room.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <Radio className="h-6 w-6 text-white/80" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {inGrace ? "Your room is waiting" : "You're still hosting"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {room.title ?? "Untitled room"}
              {inGrace && room.grace_period_until ? ` · ends in ${fmtLeft(graceMs)}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={reenter}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-60"
          >
            <LogIn className="h-3.5 w-3.5" />
            {busy === "reenter" ? "Opening…" : "Re-enter Room"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={endNow}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
          >
            <XCircle className="h-3.5 w-3.5" />
            {busy === "end" ? "Ending…" : "End Room"}
          </button>
        </div>
      </div>
    </section>
  );
}
