import { useEffect, useRef, useState } from "react";
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
 * Global compact recovery/minimized-room control.
 * It intentionally renders as one draggable floating button instead of the
 * old Home-only recovery card. The existing RPCs are retained for recovery
 * and ending the room; no duplicate room/session implementation is created.
 */
export function RoomRecoveryCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "reenter" | "end">(null);
  const [tick, setTick] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null);

  const q = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-recoverable-room", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_recoverable_room");
      if (error) throw error;
      return Array.isArray(data) && data.length ? (data[0] as Recoverable) : null;
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

  // Restore a sane vertical position after remounts, while clamping it to the
  // current viewport so the control can never become unreachable.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("jalwa-room-recovery-top"));
      if (Number.isFinite(saved) && saved > 0) setTop(saved);
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }, []);

  useEffect(() => {
    if (top == null) return;
    const clamp = () => {
      const max = Math.max(72, window.innerHeight - 92);
      setTop((v) => Math.min(Math.max(v ?? 0, 72), max));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [top]);

  if (!user || !q.data) return null;

  const room = q.data;
  const inGrace = room.status === "host_disconnected";
  const graceMs = room.grace_period_until
    ? Math.max(0, new Date(room.grace_period_until).getTime() - tick)
    : 0;

  async function reenter() {
    setBusy("reenter");
    try {
      if (inGrace) {
        const { error } = await supabase.rpc("reclaim_room", { _room_id: room.id });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["my-recoverable-room"] });
      setMenuOpen(false);
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } catch (e) {
      toast.error((e as Error).message || "Unable to re-enter room");
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
      setMenuOpen(false);
      await qc.invalidateQueries({ queryKey: ["my-recoverable-room"] });
      await qc.invalidateQueries({ queryKey: ["home-rooms"] });
    } catch (e) {
      toast.error((e as Error).message || "Unable to end room");
    } finally {
      setBusy(null);
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const startTop = top ?? Math.max(96, window.innerHeight - 180);
    dragRef.current = { startY: e.clientY, startTop, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientY - drag.startY;
    if (Math.abs(delta) > 6) drag.moved = true;
    const max = Math.max(72, window.innerHeight - 92);
    setTop(Math.min(Math.max(drag.startTop + delta, 72), max));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already have been released.
    }
    if (!drag?.moved) setMenuOpen((v) => !v);
    else {
      const next = top ?? drag.startTop;
      try {
        localStorage.setItem("jalwa-room-recovery-top", String(next));
      } catch {
        // Non-persistent environments are fine; position remains in memory.
      }
    }
  };

  const buttonTop = top ?? Math.max(96, typeof window !== "undefined" ? window.innerHeight - 180 : 120);

  return (
    <div
      className="fixed right-3 z-[70] flex flex-col items-end gap-2"
      style={{ top: buttonTop, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {menuOpen && (
        <div className="w-52 overflow-hidden rounded-2xl border border-white/10 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2 px-2 py-1">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-black/30">
              {room.cover_url ? (
                <img src={room.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center"><Radio className="h-4 w-4" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{room.title ?? "Voice Room"}</p>
              <p className="text-[10px] text-muted-foreground">
                {inGrace ? `Waiting · ${fmtLeft(graceMs)}` : "Voice Room active"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={reenter}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {busy === "reenter" ? "Opening…" : "Is Room Mein Jayein"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={endNow}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            {busy === "end" ? "Ending…" : "End Room"}
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Return to active Voice Room"
        title={room.title ?? "Voice Room"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        className="relative grid h-14 w-14 touch-none select-none place-items-center overflow-visible rounded-full border-2 border-white/20 bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] p-[2px] shadow-2xl ring-2 ring-black/20 active:scale-95"
      >
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-background">
          {room.cover_url ? (
            <img src={room.cover_url} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <Radio className="h-6 w-6 text-white" aria-hidden />
          )}
        </span>
        <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-400" aria-label="Live" />
        {inGrace && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/30 bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
            {fmtLeft(graceMs)}
          </span>
        )}
      </button>
    </div>
  );
}
