import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Swords, X, Loader2, Radio, Clock, Trophy, Shuffle, Users } from "lucide-react";
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
    // auto-timeout after 60s
    const stop = setTimeout(() => {
      void supabase.rpc("pk_leave_queue");
      setSearching(false);
      toast.message("No opponent found. Try again!");
    }, 60_000);
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
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-[81] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-[color:var(--destructive)]/40 bg-gradient-to-b from-[#2d0b4d] to-[#1a0b2e] p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Swords className="h-5 w-5 text-[color:var(--destructive)]" /> Live PK Match
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1">
          <button
            onClick={() => setTab("random")}
            className={`flex items-center justify-center gap-1 rounded-full py-2 text-xs font-bold transition ${
              tab === "random"
                ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--gold)] text-white"
                : "text-white/60"
            }`}
          >
            <Shuffle className="h-3.5 w-3.5" /> Random
          </button>
          <button
            onClick={() => setTab("pick")}
            className={`flex items-center justify-center gap-1 rounded-full py-2 text-xs font-bold transition ${
              tab === "pick"
                ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--gold)] text-white"
                : "text-white/60"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Pick Host
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-white/60">
          Match duration
        </label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {([180, 300, 600] as const).map((sec) => {
            const active = duration === sec;
            return (
              <button
                key={sec}
                disabled={searching}
                onClick={() => setDuration(sec)}
                className={`rounded-full py-2 text-xs font-bold transition disabled:opacity-40 ${
                  active
                    ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--gold)] text-white"
                    : "border border-white/15 bg-white/5 text-white/80"
                }`}
              >
                <Clock className="mr-1 inline h-3 w-3" />
                {sec / 60} min
              </button>
            );
          })}
        </div>

        {tab === "random" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {searching ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-[color:var(--destructive)]/40" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[color:var(--destructive)] to-[color:var(--gold)]">
                    <Shuffle className="h-7 w-7 text-white" />
                  </div>
                </div>
                <p className="text-sm font-extrabold text-white">
                  Searching for opponent…
                </p>
                <p className="text-[11px] text-white/60">
                  Waited {waitedSec}s · auto-cancels at 60s
                </p>
                <button
                  onClick={cancelSearch}
                  className="mt-1 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/90"
                >
                  Cancel search
                </button>
              </div>
            ) : (
              <>
                <p className="mb-3 text-center text-xs text-white/70">
                  Get instantly paired with another random live host who's also
                  looking for a PK battle.
                </p>
                <button
                  onClick={findRandom}
                  className="glow-4d flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--destructive)] via-pink-500 to-[color:var(--gold)] py-3 text-sm font-extrabold text-white"
                >
                  <Shuffle className="h-4 w-4" />
                  Find Random Opponent
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold text-white/60">
              Pick a live host to challenge
            </p>
            <div className="scrollbar-hide max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {hosts.isLoading && (
                <div className="grid h-24 place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              )}
              {!hosts.isLoading && (hosts.data?.length ?? 0) === 0 && (
                <p className="py-8 text-center text-xs text-white/50">
                  No other live hosts right now.
                </p>
              )}
              {hosts.data?.map((h) => {
                const inPk = !!h.active_pk_match_id;
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/30">
                      {h.cover_url || h.host?.avatar ? (
                        <img
                          src={h.cover_url ?? h.host?.avatar ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Radio className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{h.title}</p>
                      <p className="truncate text-[11px] text-white/50">
                        @{h.host?.username ?? "host"} · {h.viewer_count} watching
                      </p>
                    </div>
                    <button
                      disabled={inPk || busy === h.host_id}
                      onClick={() => challenge(h.host_id)}
                      className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--gold)] px-3.5 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
                    >
                      {busy === h.host_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Swords className="h-3 w-3" />
                      )}
                      {inPk ? "In PK" : "Challenge"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
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
            @{invite.from_profile?.username ?? "host"} wants to PK!
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



/* ---------------- ACTIVE MATCH OVERLAY (score bar + timer) --------------- */

export function PkMatchOverlay({
  matchId,
  meHostId,
}: {
  matchId: string;
  meHostId: string | null;
}) {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);

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

  // 1s ticker for countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // subscribe to gift_sends to refresh score immediately
  useEffect(() => {
    if (!match.data) return;
    const ch = supabase
      .channel(`pk_gifts:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends" },
        (payload: any) => {
          const rid = payload?.new?.receiver_id;
          if (rid === match.data!.host_a || rid === match.data!.host_b) {
            qc.invalidateQueries({ queryKey: ["pk_score", matchId] });
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

  // Auto-end when timer hits 0 (any client can call — RPC is idempotent)
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

  // Winner celebration: show fullscreen for 6s when status transitions to ended
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
  const pctA = Math.max(6, Math.min(94, (Number(sA) / total) * 100));

  const pA = profiles.data?.get(m.host_a);
  const pB = profiles.data?.get(m.host_b);
  const isHostA = meHostId === m.host_a;
  const isHostB = meHostId === m.host_b;
  const canEndEarly = isHostA || isHostB;

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const winnerProfile = m.winner_id
    ? m.winner_id === m.host_a
      ? pA
      : pB
    : null;
  const iWon = m.winner_id && meHostId === m.winner_id;

  return (
    <>
      {/* Winner celebration overlay (6s) */}
      {celebrateFor === m.id && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 backdrop-blur-md">
          <div className="animate-in zoom-in-95 fade-in mx-6 max-w-[400px] rounded-3xl border border-[color:var(--gold)]/50 bg-gradient-to-br from-[#2d0b4d] via-[#4d0b2e] to-[#1a0b2e] p-6 text-center shadow-2xl">
            {m.winner_id ? (
              <>
                <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--destructive)] shadow-[0_0_40px_rgba(255,200,0,0.6)]">
                  <Trophy className="h-10 w-10 text-white" />
                </div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[color:var(--gold)]">
                  {iWon ? "🎉 Victory!" : "PK Match Winner"}
                </p>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-[color:var(--gold)]">
                  {winnerProfile?.avatar ? (
                    <img
                      src={winnerProfile.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Swords className="h-6 w-6 text-white" />
                  )}
                </div>
                <p className="text-lg font-extrabold text-white">
                  @{winnerProfile?.username ?? "host"}
                </p>
                <p className="mb-4 text-xs text-white/70">
                  {Number(iWon ? sA + sB : Math.max(sA, sB)).toLocaleString()} pts collected
                </p>
                {iWon && (
                  <div className="mb-3 rounded-xl bg-[color:var(--gold)]/15 py-2 text-sm font-extrabold text-[color:var(--gold)]">
                    +500 coins bonus
                  </div>
                )}
                <div className="flex justify-center gap-2 text-xs">
                  <span className="rounded-full bg-red-500/20 px-3 py-1 font-bold text-red-300">
                    @{pA?.username ?? "A"} · {Number(sA).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 font-bold text-blue-300">
                    @{pB?.username ?? "B"} · {Number(sB).toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-white/10">
                  <Swords className="h-10 w-10 text-white/70" />
                </div>
                <p className="text-lg font-extrabold text-white">It&apos;s a Draw!</p>
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

      <div className="pointer-events-none fixed inset-x-2 top-16 z-[60] mx-auto max-w-[440px]">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 p-2 shadow-2xl backdrop-blur-md">
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="flex items-center gap-1 text-red-300">
              <Swords className="h-3 w-3" /> PK MATCH
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                remaining <= 10 && !isEnded
                  ? "bg-red-500/30 text-red-100"
                  : "bg-white/10 text-white/80"
              }`}
            >
              <Clock className="h-3 w-3" /> {mm}:{ss}
            </span>
            {canEndEarly && !isEnded && (
              <button
                onClick={() =>
                  supabase
                    .rpc("pk_end_match", { _match_id: matchId })
                    .then(() => qc.invalidateQueries({ queryKey: ["pk_active_match", matchId] }))
                }
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80"
              >
                End
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <HostPill name={pA?.username} avatar={pA?.avatar} side="a" />
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-r-full bg-gradient-to-r from-red-500 via-red-400 to-pink-400 transition-all"
                style={{ width: `${pctA}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 rounded-l-full bg-gradient-to-l from-blue-500 via-blue-400 to-cyan-400 transition-all"
                style={{ width: `${100 - pctA}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/80"
                style={{ left: `${pctA}%` }}
              />
            </div>
            <HostPill name={pB?.username} avatar={pB?.avatar} side="b" />
          </div>

          <div className="mt-1 flex justify-between px-1 text-[10px] font-bold">
            <span className="text-red-300">🔴 {Number(sA).toLocaleString()}</span>
            <span className="text-blue-300">{Number(sB).toLocaleString()} 🔵</span>
          </div>

          {isEnded && (
            <div className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[color:var(--gold)]/20 to-[color:var(--destructive)]/20 py-1.5 text-[11px] font-extrabold text-white">
              <Trophy className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              {m.winner_id
                ? `Winner: @${
                    (m.winner_id === m.host_a ? pA?.username : pB?.username) ?? "host"
                  }`
                : "It's a draw!"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function HostPill({
  name,
  avatar,
  side,
}: {
  name?: string | null;
  avatar?: string | null;
  side: "a" | "b";
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 ${
        side === "a" ? "bg-red-500/20" : "bg-blue-500/20"
      }`}
    >
      <div className="grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-white/20">
        {avatar ? <img src={avatar} className="h-full w-full object-cover" alt="" /> : null}
      </div>
      <span className="max-w-[54px] truncate text-[10px] font-bold text-white">
        @{name ?? "host"}
      </span>
    </div>
  );
}
