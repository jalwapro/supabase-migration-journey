import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Swords, X, Loader2, Radio, Clock, Trophy, Shuffle, Users, Crown, Flame, Zap, Skull } from "lucide-react";
import { toast } from "sonner";


type LiveHost = {
  id: string;
  host_id: string;
  title: string;
  cover_url: string | null;
  viewer_count: number;
  active_pk_match_id: string | null;
  host: { username: string | null; avatar: string | null } | null;
};

type Invite = {
  id: string;
  from_host: string;
  to_host: string;
  from_room: string;
  duration_sec: number;
  status: string;
  expires_at: string;
  created_at: string;
  from_profile?: { username: string | null; avatar: string | null } | null;
};

type Match = {
  id: string;
  host_a: string;
  host_b: string;
  room_a: string;
  room_b: string;
  duration_sec: number;
  started_at: string;
  ends_at: string;
  ended_at: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  status: string;
};

/* ---------------- CHALLENGE SHEET (host picks opponent) ------------------ */

export function PkBattleSheet({
  open,
  onClose,
  currentRoomId,
}: {
  open: boolean;
  onClose: () => void;
  currentRoomId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"random" | "pick">("random");
  const [duration, setDuration] = useState<180 | 300 | 600>(180);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [waitedSec, setWaitedSec] = useState(0);

  const hosts = useQuery({
    enabled: open && !!user && tab === "pick",
    queryKey: ["pk_live_hosts", currentRoomId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id,host_id,title,cover_url,viewer_count,active_pk_match_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .neq("id", currentRoomId)
        .order("viewer_count", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as LiveHost[];
    },
  });

  async function challenge(toHost: string) {
    setBusy(toHost);
    const { error } = await supabase.rpc("pk_send_invite", {
      _to_host: toHost,
      _duration_sec: duration,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Challenge sent — waiting for reply");
    onClose();
  }

  // ---------- Random matchmaking ----------
  async function findRandom() {
    if (searching) return;
    setSearching(true);
    setWaitedSec(0);
    const { data, error } = await supabase.rpc("pk_join_random_queue", {
      _duration_sec: duration,
    });
    if (error) {
      setSearching(false);
      return toast.error(error.message);
    }
    const match = (Array.isArray(data) ? data[0] : data) as Match | null;
    if (match) {
      // Instantly paired — seed cache, close sheet, overlay mounts.
      qc.setQueryData(["room", currentRoomId], (prev: any) =>
        prev ? { ...prev, active_pk_match_id: match.id } : prev,
      );
      qc.invalidateQueries({ queryKey: ["room", currentRoomId] });
      qc.invalidateQueries({ queryKey: ["pk_active_match", match.id] });
      setSearching(false);
      toast.success("Matched! PK is live!");
      onClose();
    }
    // else: waiting in queue — realtime on live_rooms will fire when paired.
  }

  async function cancelSearch() {
    await supabase.rpc("pk_leave_queue");
    setSearching(false);
    toast.message("Search cancelled");
  }

  // TikTok-style "Next": skip current queue slot, requeue fresh to pair with a different host.
  async function nextOpponent() {
    await supabase.rpc("pk_leave_queue");
    setWaitedSec(0);
    const { data, error } = await supabase.rpc("pk_join_random_queue", {
      _duration_sec: duration,
    });
    if (error) return toast.error(error.message);
    const match = (Array.isArray(data) ? data[0] : data) as Match | null;
    if (match) {
      qc.setQueryData(["room", currentRoomId], (prev: any) =>
        prev ? { ...prev, active_pk_match_id: match.id } : prev,
      );
      qc.invalidateQueries({ queryKey: ["room", currentRoomId] });
      qc.invalidateQueries({ queryKey: ["pk_active_match", match.id] });
      setSearching(false);
      toast.success("Matched! PK is live!");
      onClose();
    } else {
      toast.message("Searching next host…");
    }
  }

  // While searching: tick + poll own live room for active_pk_match_id.
  useEffect(() => {
    if (!searching || !user) return;
    const t = setInterval(() => setWaitedSec((n) => n + 1), 1000);
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("active_pk_match_id")
        .eq("id", currentRoomId)
        .maybeSingle();
      if (data?.active_pk_match_id) {
        qc.setQueryData(["room", currentRoomId], (prev: any) =>
          prev ? { ...prev, active_pk_match_id: data.active_pk_match_id } : prev,
        );
        qc.invalidateQueries({ queryKey: ["room", currentRoomId] });
        setSearching(false);
        toast.success("Matched! PK is live!");
        onClose();
      }
    }, 2500);
    // auto-timeout after 3 min (keeps trying to pair with any next queued host)
    const stop = setTimeout(() => {
      void supabase.rpc("pk_leave_queue");
      setSearching(false);
      toast.message("No opponent found. Try again!");
    }, 180_000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [searching, user, currentRoomId, qc, onClose]);

  // Clean up queue if the sheet closes while searching.
  useEffect(() => {
    if (!open && searching) {
      void supabase.rpc("pk_leave_queue");
      setSearching(false);
    }
  }, [open, searching]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-[81] w-full max-w-[480px] -translate-x-1/2 overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f051a] p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        {/* Radial vignette background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f051a_85%)]" />

        {/* Corner decals — gold top, pink bottom */}
        <div className="pointer-events-none absolute left-0 top-0 h-12 w-12 border-l-2 border-t-2 border-[#ffcf5c]/30" />
        <div className="pointer-events-none absolute right-0 top-0 h-12 w-12 border-r-2 border-t-2 border-[#ffcf5c]/30" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-12 border-b-2 border-l-2 border-[#ff2d87]/30" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-b-2 border-r-2 border-[#ff2d87]/30" />

        {/* Grab handle */}
        <div className="relative mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {/* Header row */}
        <div className="relative z-10 mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 p-1 pr-4 backdrop-blur-xl">
            <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#ff2d87] bg-zinc-900">
              <Swords className="h-4 w-4 text-[#ff2d87]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase leading-none tracking-widest text-white/50">
                PK Battle
              </span>
              <span className="text-sm font-bold text-white">Ready to Fight</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-xl hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs — segmented pill */}
        <div className="relative z-10 mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/5 bg-black/40 p-1 backdrop-blur-md">
          <button
            onClick={() => setTab("random")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black italic uppercase tracking-wider transition ${
              tab === "random"
                ? "bg-[#ff2d87] text-white shadow-lg shadow-[#ff2d87]/40"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Shuffle className="h-3.5 w-3.5" /> Random
          </button>
          <button
            onClick={() => setTab("pick")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black italic uppercase tracking-wider transition ${
              tab === "pick"
                ? "bg-[#ff2d87] text-white shadow-lg shadow-[#ff2d87]/40"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Pick Host
          </button>
        </div>

        {tab === "random" ? (
          <div className="relative z-10">
            {/* Massive Bebas Neue hero */}
            <div className="mb-6 flex flex-col items-center text-center italic">
              <h2 className="mb-2 text-[11px] font-black uppercase leading-none tracking-[0.3em] text-white/40">
                {searching ? "Searching" : "Incoming"}
              </h2>
              <h1
                className="text-[64px] font-normal leading-[0.85] text-white drop-shadow-[0_0_20px_rgba(255,45,135,0.6)]"
                style={{ fontFamily: "'Bebas Neue', 'Sora', sans-serif" }}
              >
                MATCH<br />
                <span className="text-[#ffcf5c] drop-shadow-[0_0_20px_rgba(255,207,92,0.4)]">
                  MAKING
                </span>
              </h1>

              <div className="mt-5 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff2d87] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff2d87]" />
                </span>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#ff2d87]">
                  {searching ? `Searching for Rival… ${waitedSec}s` : "Enter the arena"}
                </p>
              </div>
            </div>

            {/* Duration segmented control */}
            <div className="mx-auto mb-6 flex w-fit gap-1 rounded-2xl border border-white/5 bg-black/40 p-1 backdrop-blur-md">
              {([180, 300, 600] as const).map((sec) => {
                const active = duration === sec;
                return (
                  <button
                    key={sec}
                    disabled={searching}
                    onClick={() => setDuration(sec)}
                    className={`rounded-xl px-5 py-2.5 text-xs font-black italic uppercase tracking-wider transition disabled:opacity-40 ${
                      active
                        ? "bg-[#ff2d87] text-white shadow-lg shadow-[#ff2d87]/40"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {sec / 60} MIN
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            {searching ? (
              <div className="flex gap-3">
                <button
                  onClick={cancelSearch}
                  className="h-14 flex-1 rounded-2xl border border-white/15 bg-white/5 text-sm font-black italic uppercase tracking-wider text-white/80 backdrop-blur-md transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={nextOpponent}
                  className="h-14 flex-[1.5] rounded-2xl bg-[#ffcf5c] text-sm font-black italic uppercase tracking-wider text-black shadow-[0_10px_40px_-10px_rgba(255,207,92,0.6)] transition active:scale-95"
                >
                  Skip → Next
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={findRandom}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#ff2d87] text-base font-black italic uppercase tracking-wider text-white shadow-[0_10px_40px_-10px_rgba(255,45,135,0.6)] transition hover:bg-[#ff3d94] active:scale-95"
                >
                  <span>Start Random Match</span>
                  <Swords className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTab("pick")}
                  className="h-14 w-full rounded-2xl border-2 border-[#ffcf5c] bg-white/5 text-base font-black italic uppercase tracking-wider text-[#ffcf5c] transition hover:bg-[#ffcf5c]/10 active:scale-95"
                >
                  Invite / Pick Host
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-10">
            {/* Duration segmented control (same for pick tab) */}
            <div className="mx-auto mb-4 flex w-fit gap-1 rounded-2xl border border-white/5 bg-black/40 p-1 backdrop-blur-md">
              {([180, 300, 600] as const).map((sec) => {
                const active = duration === sec;
                return (
                  <button
                    key={sec}
                    onClick={() => setDuration(sec)}
                    className={`rounded-xl px-5 py-2 text-[11px] font-black italic uppercase tracking-wider transition ${
                      active
                        ? "bg-[#ff2d87] text-white shadow-lg shadow-[#ff2d87]/40"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {sec / 60} MIN
                  </button>
                );
              })}
            </div>

            <div className="mb-3 flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-white/10" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                Choose Your Rival
              </p>
              <div className="h-px w-8 bg-white/10" />
            </div>

            <div className="scrollbar-hide max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {hosts.isLoading && (
                <div className="grid h-24 place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#ff2d87]/60" />
                </div>
              )}
              {!hosts.isLoading && (hosts.data?.length ?? 0) === 0 && (
                <p className="py-8 text-center text-xs text-white/40">
                  No warriors available right now.
                </p>
              )}
              {hosts.data?.map((h) => {
                const inPk = !!h.active_pk_match_id;
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/40 p-2.5 backdrop-blur-md transition hover:border-[#ff2d87]/40"
                  >
                    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-900 ring-2 ring-[#ff2d87]/40">
                      {h.cover_url || h.host?.avatar ? (
                        <img
                          src={h.cover_url ?? h.host?.avatar ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Radio className="h-4 w-4 text-[#ff2d87]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{h.title}</p>
                      <p className="truncate text-[11px] text-white/50">
                        {h.host?.username ?? "host"} · {h.viewer_count} watching
                      </p>
                    </div>
                    <button
                      disabled={inPk || busy === h.host_id}
                      onClick={() => challenge(h.host_id)}
                      className="flex items-center gap-1 rounded-full bg-[#ff2d87] px-4 py-2 text-[11px] font-black italic uppercase tracking-wider text-white shadow-lg shadow-[#ff2d87]/40 transition active:scale-95 disabled:opacity-40"
                    >
                      {busy === h.host_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Swords className="h-3 w-3" />
                      )}
                      {inPk ? "In PK" : "Fight"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- INCOMING INVITE POPUP (for the challenged host) --------- */

export function PkIncomingInvite({ currentRoomId }: { currentRoomId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  // realtime + initial poll
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("pk_invites")
        .select(
          "id,from_host,to_host,from_room,duration_sec,status,expires_at,created_at,from_profile:profiles!pk_invites_from_host_fkey(username,avatar)",
        )
        .eq("to_host", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setInvite((data ?? null) as unknown as Invite | null);
    };
    void load();

    const ch = supabase
      .channel(`pk_inv:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pk_invites",
          filter: `to_host=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();

    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [user]);

  const remaining = useMemo(() => {
    if (!invite) return 0;
    return Math.max(0, Math.ceil((+new Date(invite.expires_at) - Date.now()) / 1000));
  }, [invite, tick]);

  useEffect(() => {
    if (invite && remaining === 0) setInvite(null);
  }, [remaining, invite]);

  async function respond(accept: boolean) {
    if (!invite) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pk_respond_invite", {
      _invite_id: invite.id,
      _accept: accept,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setInvite(null);
    if (!accept) {
      toast.message("Challenge declined");
      return;
    }

    // Optimistic: seed overlay instantly on the accepter's own room cache,
    // so it doesn't have to wait for the live_rooms realtime tick.
    const match = (Array.isArray(data) ? data[0] : data) as Match | null;
    if (match && currentRoomId) {
      qc.setQueryData(["room", currentRoomId], (prev: any) =>
        prev ? { ...prev, active_pk_match_id: match.id } : prev,
      );
    }
    // Force fresh reads on both sides.
    qc.invalidateQueries({ queryKey: ["room", currentRoomId] });
    if (match) {
      qc.invalidateQueries({ queryKey: ["room", match.room_a] });
      qc.invalidateQueries({ queryKey: ["room", match.room_b] });
      qc.invalidateQueries({ queryKey: ["pk_active_match", match.id] });
    }
    toast.success("PK Match started!");
  }

  if (!invite) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[90] mx-auto max-w-[440px]">
      <div className="glow-4d flex items-center gap-3 rounded-2xl border border-[color:var(--destructive)]/50 bg-gradient-to-r from-[#2d0b4d] to-[#4d0b2e] p-3 shadow-2xl">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
          {invite.from_profile?.avatar ? (
            <img
              src={invite.from_profile.avatar}
              className="h-full w-full object-cover"
              alt=""
            />
          ) : (
            <Swords className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-white">
            {invite.from_profile?.username ?? "host"} wants to PK!
          </p>
          <p className="text-[11px] text-white/70">
            {invite.duration_sec / 60} min · expires in {remaining}s
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => respond(false)}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80"
        >
          Decline
        </button>
        <button
          disabled={busy}
          onClick={() => respond(true)}
          className="rounded-full bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--gold)] px-3.5 py-1.5 text-xs font-extrabold text-white"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accept"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- CHALLENGER FEEDBACK (for the sending host) -------------- */
// Listens for status transitions on invites the current user SENT and:
//  - toasts accepted / declined / expired
//  - invalidates the current room query so the match overlay appears instantly
//    on the challenger side without waiting for the live_rooms realtime tick.
export function PkChallengerToasts({ currentRoomId }: { currentRoomId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`pk_out:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pk_invites",
          filter: `from_host=eq.${user.id}`,
        },
        (payload: any) => {
          const row = payload?.new as {
            id: string;
            status: string;
            match_id: string | null;
          };
          if (!row || seenRef.current.has(`${row.id}:${row.status}`)) return;
          seenRef.current.add(`${row.id}:${row.status}`);

          if (row.status === "accepted") {
            toast.success("Opponent accepted — PK is live!");
            // Seed challenger's room cache instantly, then invalidate to reconcile.
            if (row.match_id) {
              qc.setQueryData(["room", currentRoomId], (prev: any) =>
                prev ? { ...prev, active_pk_match_id: row.match_id } : prev,
              );
              qc.invalidateQueries({ queryKey: ["pk_active_match", row.match_id] });
            }
            qc.invalidateQueries({ queryKey: ["room", currentRoomId] });
          } else if (row.status === "declined") {
            toast.message("Opponent declined the challenge");
          } else if (row.status === "expired") {
            toast.message("Challenge expired — no response");
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, currentRoomId, qc]);

  return null;
}



/* ---------------- ACTIVE MATCH OVERLAY (TikTok-style) --------------------- */

type Contrib = { sender_id: string; total: number; username: string | null; avatar: string | null };

export function PkMatchOverlay({
  matchId,
  meHostId,
}: {
  matchId: string;
  meHostId: string | null;
}) {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);
  const [pulseSide, setPulseSide] = useState<"a" | "b" | null>(null);

  const match = useQuery({
    enabled: !!matchId,
    queryKey: ["pk_active_match", matchId],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pk_matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Match | null;
    },
  });

  const profiles = useQuery({
    enabled: !!match.data,
    queryKey: ["pk_hosts_profiles", match.data?.host_a, match.data?.host_b],
    queryFn: async () => {
      const ids = [match.data!.host_a, match.data!.host_b];
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, { username: string | null; avatar: string | null }>();
      (data ?? []).forEach((p: any) => map.set(p.id, { username: p.username, avatar: p.avatar }));
      return map;
    },
  });

  const score = useQuery({
    enabled: !!matchId && match.data?.status === "active",
    queryKey: ["pk_score", matchId],
    refetchInterval: 2500,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pk_match_score", { _match_id: matchId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { score_a: number; score_b: number };
    },
  });

  // Top contributors per side (top 3) within the match window
  const contribs = useQuery({
    enabled: !!match.data,
    queryKey: ["pk_top_contribs", matchId, match.data?.started_at, match.data?.ended_at ?? match.data?.ends_at],
    refetchInterval: 4000,
    queryFn: async () => {
      const m = match.data!;
      const endBoundary = m.ended_at ?? m.ends_at;
      const { data, error } = await supabase
        .from("gift_sends")
        .select("sender_id,receiver_id,coins_spent,sender:profiles!gift_sends_sender_id_fkey(username,avatar)")
        .in("receiver_id", [m.host_a, m.host_b])
        .gte("created_at", m.started_at)
        .lte("created_at", endBoundary)
        .limit(500);
      if (error) throw error;
      const agg: Record<string, { a: Map<string, Contrib>; b: Map<string, Contrib> }> = {
        _: { a: new Map(), b: new Map() },
      };
      (data ?? []).forEach((row: any) => {
        const side: "a" | "b" = row.receiver_id === m.host_a ? "a" : "b";
        const map = agg._[side];
        const cur = map.get(row.sender_id) ?? {
          sender_id: row.sender_id,
          total: 0,
          username: row.sender?.username ?? null,
          avatar: row.sender?.avatar ?? null,
        };
        cur.total += Number(row.coins_spent ?? 0);
        map.set(row.sender_id, cur);
      });
      const sort = (m: Map<string, Contrib>) =>
        [...m.values()].sort((x, y) => y.total - x.total).slice(0, 3);
      return { a: sort(agg._.a), b: sort(agg._.b) };
    },
  });

  // 1s ticker for countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // subscribe to gift_sends → refresh score + pulse the receiving side
  useEffect(() => {
    if (!match.data) return;
    const ch = supabase
      .channel(`pk_gifts:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends" },
        (payload: any) => {
          const rid = payload?.new?.receiver_id;
          if (rid === match.data!.host_a) {
            setPulseSide("a");
            setTimeout(() => setPulseSide(null), 700);
            qc.invalidateQueries({ queryKey: ["pk_score", matchId] });
            qc.invalidateQueries({ queryKey: ["pk_top_contribs", matchId] });
          } else if (rid === match.data!.host_b) {
            setPulseSide("b");
            setTimeout(() => setPulseSide(null), 700);
            qc.invalidateQueries({ queryKey: ["pk_score", matchId] });
            qc.invalidateQueries({ queryKey: ["pk_top_contribs", matchId] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId, match.data, qc]);

  const remaining = useMemo(() => {
    if (!match.data) return 0;
    return Math.max(0, Math.ceil((+new Date(match.data.ends_at) - Date.now()) / 1000));
  }, [match.data, tick]);

  // Auto-end when timer hits 0
  useEffect(() => {
    if (!match.data || match.data.status !== "active") return;
    if (remaining > 0) return;
    void supabase.rpc("pk_end_match", { _match_id: matchId }).then(() => {
      qc.invalidateQueries({ queryKey: ["pk_active_match", matchId] });
      qc.invalidateQueries({ queryKey: ["room", match.data!.room_a] });
      qc.invalidateQueries({ queryKey: ["room", match.data!.room_b] });
    });
  }, [remaining, match.data, matchId, qc]);

  const m = match.data;

  // Winner celebration
  const [celebrateFor, setCelebrateFor] = useState<string | null>(null);
  const celebratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!m) return;
    if (m.status === "ended" && celebratedRef.current !== m.id) {
      celebratedRef.current = m.id;
      setCelebrateFor(m.id);
      const t = setTimeout(() => setCelebrateFor(null), 6000);
      return () => clearTimeout(t);
    }
  }, [m?.id, m?.status]);

  if (!m) return null;

  const isEnded = m.status !== "active";
  const sA = isEnded ? m.score_a : score.data?.score_a ?? 0;
  const sB = isEnded ? m.score_b : score.data?.score_b ?? 0;
  const total = Math.max(1, Number(sA) + Number(sB));
  const pctA = Math.max(8, Math.min(92, (Number(sA) / total) * 100));

  const pA = profiles.data?.get(m.host_a);
  const pB = profiles.data?.get(m.host_b);
  const isHostA = meHostId === m.host_a;
  const isHostB = meHostId === m.host_b;
  const canEndEarly = isHostA || isHostB;

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const critical = remaining <= 10 && !isEnded;

  const leader: "a" | "b" | null =
    Number(sA) === Number(sB) ? null : Number(sA) > Number(sB) ? "a" : "b";
  const loserSide: "a" | "b" | null = isEnded && m.winner_id
    ? m.winner_id === m.host_a ? "b" : "a"
    : null;

  const winnerProfile = m.winner_id ? (m.winner_id === m.host_a ? pA : pB) : null;
  const iWon = m.winner_id && meHostId === m.winner_id;

  return (
    <>
      {/* Winner celebration overlay (6s) */}
      {celebrateFor === m.id && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/80 backdrop-blur-md">
          <div className="animate-in zoom-in-95 fade-in mx-6 max-w-[420px] rounded-3xl border border-[color:var(--gold)]/50 bg-gradient-to-br from-[#2d0b4d] via-[#4d0b2e] to-[#1a0b2e] p-6 text-center shadow-[0_0_80px_rgba(255,180,60,0.35)]">
            {m.winner_id ? (
              <>
                <div className="mx-auto mb-3 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--destructive)] shadow-[0_0_60px_rgba(255,200,0,0.7)]">
                  <Crown className="h-12 w-12 text-white drop-shadow" />
                </div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.25em] text-[color:var(--gold)]">
                  {iWon ? "🎉 Victory" : "PK Winner"}
                </p>
                <div className="mx-auto mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-[color:var(--gold)] shadow-lg">
                  {winnerProfile?.avatar ? (
                    <img src={winnerProfile.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Swords className="h-6 w-6 text-white" />
                  )}
                </div>
                <p className="text-xl font-black text-white">@{winnerProfile?.username ?? "host"}</p>
                <p className="mb-4 text-xs text-white/70">
                  {Number(Math.max(sA, sB)).toLocaleString()} pts collected
                </p>
                {iWon && (
                  <div className="mb-3 rounded-xl bg-[color:var(--gold)]/15 py-2 text-sm font-extrabold text-[color:var(--gold)]">
                    +500 coins bonus
                  </div>
                )}
                <div className="flex justify-center gap-2 text-xs">
                  <span className="rounded-full bg-red-500/25 px-3 py-1 font-bold text-red-200">
                    🔴 @{pA?.username ?? "A"} · {Number(sA).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-blue-500/25 px-3 py-1 font-bold text-blue-200">
                    🔵 @{pB?.username ?? "B"} · {Number(sB).toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-white/10">
                  <Swords className="h-10 w-10 text-white/70" />
                </div>
                <p className="text-xl font-black text-white">It&apos;s a Draw!</p>
                <p className="text-xs text-white/60">Both hosts fought equal — respect!</p>
              </>
            )}
            <button
              onClick={() => setCelebrateFor(null)}
              className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold text-white/80"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Epic Warrior HUD: compact royal header + gold-diamond VS scoreboard */}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-[60] mx-auto flex max-w-[480px] flex-col px-3">
        {/* Team labels + timer */}
        <div className="pointer-events-auto mb-1 flex items-end justify-between text-[10px] font-black uppercase tracking-[0.18em]">
          <span className={`truncate drop-shadow-[0_0_6px_rgba(244,63,94,0.8)] ${leader === "a" ? "text-rose-300" : "text-rose-400/80"}`}>
            {isHostA && "⚔ "}@{pA?.username ?? "host A"}
          </span>
          <span
            className={`mx-2 flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums ${
              critical
                ? "animate-pulse border-red-400 bg-red-500/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.7)]"
                : "border-[color:var(--gold)]/60 bg-black/70 text-[color:var(--gold)] backdrop-blur-md"
            }`}
          >
            <Clock className="h-3 w-3" /> {mm}:{ss}
          </span>
          <span className={`truncate text-right drop-shadow-[0_0_6px_rgba(96,165,250,0.8)] ${leader === "b" ? "text-sky-300" : "text-sky-400/80"}`}>
            @{pB?.username ?? "host B"}{isHostB && " ⚔"}
          </span>
        </div>

        {/* Gold-ringed PK progress bar with diamond VS pin */}
        <div className="pointer-events-auto relative h-6 w-full overflow-hidden rounded-full border-2 border-[color:var(--gold)]/60 bg-neutral-950/80 shadow-[0_0_20px_rgba(217,119,6,0.35)] backdrop-blur-md">
          {/* pulse flash on gift */}
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 transition-opacity duration-500 ${
              pulseSide === "a" ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: "radial-gradient(closest-side, rgba(244,63,94,0.6), transparent 70%)" }}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-1/2 transition-opacity duration-500 ${
              pulseSide === "b" ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: "radial-gradient(closest-side, rgba(59,130,246,0.6), transparent 70%)" }}
          />

          {/* rose side A */}
          <div
            className="absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-rose-700 to-rose-400 px-2 transition-all duration-500"
            style={{ width: `${pctA}%` }}
          >
            <span className="text-[10px] font-black italic tabular-nums text-white drop-shadow">
              {Number(sA).toLocaleString()}
            </span>
          </div>
          {/* blue side B */}
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-blue-700 to-blue-400 px-2 transition-all duration-500"
            style={{ width: `${100 - pctA}%` }}
          >
            <span className="text-[10px] font-black italic tabular-nums text-white drop-shadow">
              {Number(sB).toLocaleString()}
            </span>
          </div>

          {/* Gold diamond VS pin */}
          <div
            className="absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center border-2 border-[color:var(--gold)] bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_0_14px_#fbbf24] transition-all duration-500"
            style={{ left: `${pctA}%` }}
          >
            <span className="-rotate-45 text-[8px] font-black uppercase tracking-wider text-white">VS</span>
          </div>
        </div>

        {/* End PK button for participants */}
        {canEndEarly && !isEnded && (
          <button
            onClick={() => {
              if (!confirm("End this PK match now?")) return;
              supabase
                .rpc("pk_end_match", { _match_id: matchId })
                .then(() => qc.invalidateQueries({ queryKey: ["pk_active_match", matchId] }));
            }}
            className="pointer-events-auto mx-auto mt-2 rounded-full border border-[color:var(--gold)]/40 bg-gradient-to-r from-red-700 to-red-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg active:scale-[0.98]"
          >
            🛑 End PK
          </button>
        )}

        {isEnded && (
          <div className="pointer-events-auto mx-auto mt-2 flex items-center gap-1 rounded-full border border-[color:var(--gold)]/40 bg-gradient-to-r from-[color:var(--gold)]/25 to-[color:var(--destructive)]/25 px-3 py-1 text-[11px] font-black text-white backdrop-blur-md">
            <Trophy className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            {m.winner_id
              ? `Winner: @${(m.winner_id === m.host_a ? pA?.username : pB?.username) ?? "host"}`
              : "It's a draw!"}
          </div>
        )}
      </div>

    </>
  );
}

function HostBlock({
  side,
  profile,
  score,
  isLeader,
  isMe,
  contribs,
  punished,
}: {
  side: "a" | "b";
  profile?: { username: string | null; avatar: string | null };
  score: number;
  isLeader: boolean;
  isMe: boolean;
  contribs: Contrib[];
  punished: boolean;
}) {
  const isA = side === "a";
  const accent = isA ? "from-red-500 to-pink-500" : "from-blue-500 to-cyan-400";
  const bg = isA ? "bg-red-500/15" : "bg-blue-500/15";
  const border = isA ? "border-red-400/40" : "border-blue-400/40";

  return (
    <div
      className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl border ${border} ${bg} p-1.5 ${
        isA ? "" : "flex-row-reverse"
      }`}
    >
      {/* Leader crown */}
      {isLeader && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <Crown className="h-4 w-4 text-[color:var(--gold)] drop-shadow-[0_0_6px_rgba(255,200,0,0.9)]" />
        </div>
      )}
      {/* Punishment stripe */}
      {punished && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-black/55">
          <div className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase text-red-300">
            <Skull className="h-3 w-3" /> Penalty
          </div>
        </div>
      )}
      <div className={`flex w-full items-center gap-1.5 ${isA ? "" : "flex-row-reverse"}`}>
        <div
          className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 ${
            isLeader ? "border-[color:var(--gold)]" : "border-white/30"
          }`}
        >
          {profile?.avatar ? (
            <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <Swords className="h-4 w-4 text-white/60" />
          )}
        </div>
        <div className={`min-w-0 flex-1 ${isA ? "text-left" : "text-right"}`}>
          <p className="truncate text-[11px] font-black text-white">
            @{profile?.username ?? (isA ? "hostA" : "hostB")}
            {isMe && <span className="ml-1 text-[9px] font-bold text-white/60">YOU</span>}
          </p>
          <p className={`bg-gradient-to-r ${accent} bg-clip-text text-[13px] font-black tabular-nums text-transparent`}>
            {score.toLocaleString()}
          </p>
        </div>
      </div>


    </div>
  );
}

