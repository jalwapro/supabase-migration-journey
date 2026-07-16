import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useZegoRoom as useAgoraRoom } from "@/hooks/useZegoRoom";

function uidFromUuid(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 1;
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DoorOpen,
  Users,
  
  Timer,
  Zap,
  Crown,
  FileText,
  Plus,
  Check,
  Coins,
  Pencil,
  Gift,
  Share2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Hand,
  Send,
  Smile,
  Trophy,
  Shield,
  Swords,
  Shuffle,
  SkipForward,
  MessageCircle,

} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pk/$roomId")({
  component: PkMatchPage,
});

type PkMode = "quick" | "normal" | "challenge";
const MODE_META: Record<PkMode, { label: string; minutes: number; sec: number; sub: string; icon: any; accent: string }> = {
  normal: { label: "Normal PK", minutes: 5, sec: 300, sub: "Standard PK battle", icon: Timer, accent: "from-sky-500/25 to-blue-600/10 border-sky-400/50" },
  quick: { label: "Quick PK", minutes: 3, sec: 180, sub: "Quick battle", icon: Zap, accent: "from-violet-500/25 to-fuchsia-600/10 border-violet-400/50" },
  challenge: { label: "Challenge PK", minutes: 10, sec: 600, sub: "High reward", icon: Crown, accent: "from-amber-500/25 to-orange-600/10 border-amber-400/50" },
};

const STAKES = [100, 500, 1000, 5000];

type LiveHost = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  host: { username: string | null; avatar: string | null } | null;
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
  status: "active" | "ended" | "cancelled";
  winner_id: string | null;
  stake_coins?: number | null;
};

function PkMatchPage() {
  const { roomId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<PkMode>("normal");
  const [stake, setStake] = useState<number>(100);
  const [customStake, setCustomStake] = useState<string>("");
  const [customOpen, setCustomOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"choice" | "random" | "pick">("choice");
  const [randomIdx, setRandomIdx] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [opponent, setOpponent] = useState<LiveHost | null>(null);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Current room + host profile
  const roomQ = useQuery({
    queryKey: ["pk-room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("id,title,host_id,viewer_count,active_pk_match_id,rtc_channel,status,host:profiles!live_rooms_host_id_fkey(username,avatar,coins)")
        .eq("id", roomId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const room = roomQ.data;
  const isHost = !!(user?.id && room?.host_id === user.id);
  const activeMatchId: string | null = room?.active_pk_match_id ?? null;

  // ── Live audio + video via Zego ───────────────────────────────
  const myUid = user ? uidFromUuid(user.id) : null;
  const agora = useAgoraRoom({
    channel: room?.rtc_channel ?? null,
    uid: myUid,
    publish: isHost,
    video: true,
    kind: "video",
    enabled: !!user && !!room && room.status === "live",
  });

  // Host: auto-start mic + camera when connected (single user gesture flow —
  // the tap that entered the room counts on mobile once we're inside the
  // route; we still guard against re-toggling).
  const autoCamRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (agora.status !== "connected") return;
    if (autoCamRef.current) return;
    autoCamRef.current = true;
    void (async () => {
      try { await agora.requestMic(); } catch { /* ignore */ }
      try {
        if (!agora.videoOn) await agora.toggleVideo();
      } catch { /* ignore */ }
    })();
  }, [isHost, agora.status, agora.videoOn, agora]);



  // Active match if any
  const matchQ = useQuery({
    enabled: !!activeMatchId,
    queryKey: ["pk-match", activeMatchId],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pk_matches").select("*").eq("id", activeMatchId).maybeSingle();
      if (error) throw error;
      return data as Match | null;
    },
  });
  const match = matchQ.data ?? null;

  // Live score
  const scoreQ = useQuery({
    enabled: !!activeMatchId && match?.status === "active",
    queryKey: ["pk-score", activeMatchId],
    refetchInterval: 2500,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pk_match_score", { _match_id: activeMatchId! });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? { score_a: 0, score_b: 0 }) as { score_a: number; score_b: number };
    },
  });

  // Live hosts for opponent picker
  const hostsQ = useQuery({
    enabled: pickerOpen || (isHost && !opponent && !match),
    queryKey: ["pk-live-hosts", roomId],
    queryFn: async () => {
      // Only rooms in the PK category can be challenged
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "pk")
        .maybeSingle();
      const pkCatId = (cat as any)?.id ?? null;
      let q = supabase
        .from("live_rooms")
        .select("id,host_id,title,viewer_count,category_id,host:profiles!live_rooms_host_id_fkey(username,avatar)")
        .eq("status", "live")
        .neq("id", roomId);
      if (pkCatId) q = q.eq("category_id", pkCatId);
      const { data, error } = await q.order("viewer_count", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as LiveHost[];
    },

  });

  // Chat messages (last 30) for the room
  const chatQ = useQuery({
    queryKey: ["pk-chat", roomId],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_messages")
        .select("id,user_id,body,kind,created_at,profiles:profiles(username,avatar)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return ((data ?? []) as any[]).reverse();
    },
  });

  // Opponent host profile (once a match is active)
  const ourHostId = room?.host_id ?? user?.id ?? null;
  const opponentHostId = match ? (match.host_a === ourHostId ? match.host_b : match.host_a) : null;

  const opponentQ = useQuery({
    enabled: !!opponentHostId,
    queryKey: ["pk-opponent", opponentHostId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .eq("id", opponentHostId!)
        .maybeSingle();
      return data as { id: string; username: string | null; avatar: string | null } | null;
    },
  });

  // Follow state
  const followQ = useQuery({
    enabled: !!user && !!room?.host_id && user?.id !== room?.host_id,
    queryKey: ["pk-follows-host", user?.id, room?.host_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", room!.host_id)
        .maybeSingle();
      return !!data;
    },
  });

  async function toggleFollow() {
    if (!user || !room) return;
    if (followQ.data) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", room.host_id);
      if (error) return toast.error(error.message);
      toast.success("Unfollowed");
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: room.host_id });
      if (error && error.code !== "23505") return toast.error(error.message);
      toast.success("Following host");
    }
    followQ.refetch();
  }

  // Incoming pending invites addressed to me
  const incomingQ = useQuery({
    enabled: !!user && isHost,
    queryKey: ["pk-incoming", user?.id],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase
        .from("pk_invites")
        .select("id,from_host,from_room,duration_sec,expires_at,status,stake_coins")
        .eq("to_host", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      const inv = (data ?? [])[0];
      if (!inv) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("username,avatar")
        .eq("id", inv.from_host)
        .maybeSingle();
      return { ...inv, from: prof ?? null } as any;
    },

  });
  const incoming = incomingQ.data as any;

  async function respondInvite(accept: boolean) {
    if (!incoming) return;
    const { error } = await supabase.rpc("pk_respond_invite", {
      _invite_id: incoming.id,
      _accept: accept,
    });
    if (error) return toast.error(error.message);
    toast.success(accept ? "Match started!" : "Declined");
    incomingQ.refetch();
    matchQ.refetch();
    roomQ.refetch();
  }

  // Countdown for match starts / ends
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);


  const endsInSec = useMemo(() => {
    if (!match?.ends_at) return null;
    return Math.max(0, Math.floor((new Date(match.ends_at).getTime() - now) / 1000));
  }, [match?.ends_at, now]);

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Auto-end match when clock hits 0
  const endTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (match?.status === "active" && endsInSec === 0 && endTriggeredRef.current !== match.id) {
      endTriggeredRef.current = match.id;
      void supabase.rpc("pk_end_match", { _match_id: match.id }).then(() => {
        matchQ.refetch();
        roomQ.refetch();
      });
    }
  }, [match?.id, match?.status, endsInSec]);

  const effectiveStake = customOpen && customStake ? Math.max(0, parseInt(customStake, 10) || 0) : stake;

  async function doExit() {
    if (user && isHost) {
      try {
        // End any active PK match first
        if (match?.status === "active") {
          await supabase.rpc("pk_end_match", { _match_id: match.id });
        }
        // Finalize accumulated gifts → diamonds and mark room ended
        await supabase.rpc("finalize_room_gifts", { _room_id: roomId }).then(({ error }) => {
          if (error) throw error;
        });
        const { error: updErr } = await supabase
          .from("live_rooms")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", roomId);
        if (updErr) throw updErr;
      } catch (e) {
        toast.error(`Couldn't end room: ${(e as Error).message}`);
        return;
      }
    } else if (user) {
      await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }
    setExitConfirmOpen(false);
    setExiting(true);
    setTimeout(() => {
      navigate({ to: "/" });
    }, 700);
  }

  function openStartFlow() {
    if (!isHost) return toast.error("Only the host can start a PK");
    if (!opponent) {
      setPickerOpen(true);
      return;
    }
    if ((profile?.coins ?? 0) < effectiveStake) {
      return toast.error("Not enough coins for this stake");
    }
    setModeSheetOpen(true);
  }

  async function startBattle(chosenMode: PkMode) {
    if (!isHost) return toast.error("Only the host can start a PK");
    if (!opponent) return;
    setMode(chosenMode);
    setModeSheetOpen(false);
    setStarting(true);
    const { data, error } = await supabase.rpc("pk_send_invite", {
      _to_host: opponent.host_id,
      _duration_sec: MODE_META[chosenMode].sec,
    });
    if (error) {
      setStarting(false);
      return toast.error(error.message);
    }
    const inviteId = (Array.isArray(data) ? data[0]?.id : (data as any)?.id) ?? null;
    if (inviteId && effectiveStake > 0) {
      await supabase.from("pk_invites").update({ stake_coins: effectiveStake }).eq("id", inviteId);
    }
    setStarting(false);
    toast.success(`Challenge sent to ${opponent.host?.username ?? "opponent"} — ${MODE_META[chosenMode].minutes} min`);
    setOpponent(null);
  }

  async function shareRoom() {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: room?.title ?? "Live Room", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }




  async function sendMessage() {
    const body = message.trim();
    if (!body || !user) return;
    setMessage("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      body,
      kind: "text",
    } as any);
    if (error) toast.error(error.message);
  }

  const hostSideScore = scoreQ.data?.score_a ?? 0;
  const oppSideScore = scoreQ.data?.score_b ?? 0;
  const totalScore = hostSideScore + oppSideScore;
  const hostPct = totalScore > 0 ? Math.round((hostSideScore / totalScore) * 100) : 50;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-gradient-to-b from-[#0a0416] via-[#0d0620] to-black text-white">
      {/* Header — same as Video Room */}
      <div
        className="relative z-10 mx-auto w-full max-w-md px-3 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExitConfirmOpen(true)}
            aria-label="Exit room"
            className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-400/50 bg-gradient-to-br from-rose-500/30 via-rose-600/20 to-black/60 text-white shadow-[0_0_16px_-2px_rgba(244,63,94,0.6)] backdrop-blur-md active:scale-90"
          >
            <DoorOpen className="h-5 w-5 text-rose-200 transition-transform group-active:-translate-x-0.5" />
            <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[1.5px] text-rose-200/90">
              Exit
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="truncate text-[15px] font-black text-white">
                {room?.title ?? "Live Room"}
              </span>
              <Zap className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
            </div>
            <div className="mt-0.5 flex items-center gap-2.5 text-[10px] font-semibold text-white/60">
              <span>Room ID: {roomId.slice(0, 6)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isHost && !followQ.data ? (
              <button
                onClick={toggleFollow}
                aria-label="Follow host"
                title="Follow"
                className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-[0_0_12px_-2px_color-mix(in_oklab,var(--primary)_65%,transparent)] transition active:scale-90"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={shareRoom}
              aria-label="Share"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-md active:scale-95"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2 py-1 backdrop-blur-md">
              <Users className="h-3 w-3 text-white/70" />
              <span className="text-[11px] font-black text-white">
                {room?.viewer_count ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* Incoming challenge banner */}
      {incoming && (
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-[color:var(--gold)]/50 bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10 p-3">
          {incoming.from?.avatar ? (
            <img src={incoming.from.avatar} className="h-11 w-11 rounded-full object-cover ring-2 ring-[color:var(--gold)]/60" alt="" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-sm font-bold uppercase text-white/80 ring-2 ring-[color:var(--gold)]/60">
              {(incoming.from?.username ?? "?").charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold">
              {incoming.from?.username ?? "A host"} challenged you
            </div>
            <div className="text-[11px] text-white/60">
              {Math.round(incoming.duration_sec / 60)} min PK
              {incoming.stake_coins ? ` • ${incoming.stake_coins} coins stake` : ""}
            </div>
          </div>
          <button
            onClick={() => respondInvite(false)}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/80"
          >
            Decline
          </button>
          <button
            onClick={() => respondInvite(true)}
            className="rounded-full bg-gradient-to-r from-sky-500 to-fuchsia-500 px-3 py-1.5 text-[11px] font-black text-white"
          >
            Accept
          </button>
        </div>
      )}


      {/* VS panels */}
      <div className="relative mx-3 mt-3 grid grid-cols-2 items-stretch gap-0">
        {/* Host side — always the room host */}
        <HostPanel
          label={isHost ? "YOU" : "HOST"}
          username={room?.host?.username ?? "Host"}
          avatar={room?.host?.avatar ?? null}
          coins={hostSideScore || (room?.host?.coins ?? 0)}
          accentClass="border-[color:var(--primary)]/60 bg-gradient-to-b from-[#3a0d3f]/40 to-[#1a0625]/60 rounded-r-none border-r-0"
          crown
          videoTrack={
            isHost
              ? (agora.localVideoTrack ?? null)
              : (room?.host_id ? agora.remotes.get(uidFromUuid(room.host_id))?.videoTrack ?? null : null)
          }
          mirror={isHost}
          micOn={
            isHost
              ? (!agora.muted && !!agora.localAudioPublished.current)
              : (room?.host_id ? !!agora.remotes.get(uidFromUuid(room.host_id))?.hasAudio : undefined)
          }
          camOn={
            isHost
              ? !!agora.videoOn
              : (room?.host_id ? !!agora.remotes.get(uidFromUuid(room.host_id))?.hasVideo : undefined)
          }
        />



        {/* VS badge overlay */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative grid h-14 w-14 place-items-center rounded-full border border-[color:var(--destructive)]/60 bg-black/70 shadow-[0_0_24px_rgba(255,45,135,0.5)]">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,45,135,0.35),transparent_60%)]" />
            <div className="relative flex items-baseline text-[26px] font-black tracking-tighter">
              <span className="bg-gradient-to-b from-sky-300 to-blue-600 bg-clip-text text-transparent">V</span>
              <span className="bg-gradient-to-b from-pink-400 to-fuchsia-600 bg-clip-text text-transparent">S</span>
            </div>
          </div>
          {endsInSec != null && (
            <div className="mt-1 flex w-full flex-col items-center rounded-lg border border-white/10 bg-black/70 px-2 py-1">
              <span className="text-[8px] uppercase tracking-wider text-white/50">Ends in</span>
              <span className="text-[12px] font-black tabular-nums">{fmt(endsInSec)}</span>
            </div>
          )}
          {isHost && match?.status !== "active" && (
            <button
              onClick={openStartFlow}
              disabled={starting}
              className="pointer-events-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-3xl shadow-[0_8px_30px_-4px_rgba(244,63,94,0.8)] ring-2 ring-white/30 transition active:scale-90 disabled:opacity-60 animate-pulse"
              title="Send challenge"
              aria-label="Send match challenge"
            >
              🥊
            </button>
          )}

        </div>



        {/* Opponent side */}
        {opponent || match ? (

          <HostPanel
            label="OPPONENT"
            username={opponent?.host?.username ?? opponentQ.data?.username ?? "Opponent"}
            avatar={opponent?.host?.avatar ?? opponentQ.data?.avatar ?? null}
            coins={oppSideScore}
            accentClass="border-[color:var(--destructive)]/60 bg-gradient-to-b from-[#3f0d1d]/40 to-[#25060f]/60 rounded-l-none"
          />
        ) : !isHost ? (
          <div className="relative flex select-none flex-col items-center justify-center overflow-hidden rounded-2xl rounded-l-none border border-white/10 bg-gradient-to-b from-[#25060f]/60 to-[#0d0620]/60 p-4 text-center">
            <span className="mb-2 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
              Waiting
            </span>
            <div className="grid aspect-[9/14] w-full place-items-center rounded-xl bg-black/40 text-white/50">
              <div className="flex flex-col items-center gap-1 px-2">
                <Swords className="h-6 w-6" />
                <span className="text-[11px]">Match not started yet</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-wider text-white/40">
              Enjoy the show & send gifts
            </div>
          </div>
        ) : (() => {
          const list = hostsQ.data ?? [];
          const rnd = list.length ? list[randomIdx % list.length] : null;
          const nextOpponent = () => {
            if (list.length > 1) setRandomIdx((i) => (i + 1) % list.length);
          };
          let touchStartY = 0;
          return (
            <div
              onClick={() => { if (rnd && isHost) { setOpponent(rnd); openStartFlow(); } }}
              onWheel={(e) => { if (e.deltaY > 10) nextOpponent(); }}
              onTouchStart={(e) => { touchStartY = e.touches[0]?.clientY ?? 0; }}
              onTouchEnd={(e) => {
                const endY = e.changedTouches[0]?.clientY ?? 0;
                if (touchStartY - endY > 40) nextOpponent();
              }}
              className="relative flex cursor-pointer select-none flex-col items-stretch overflow-hidden rounded-2xl rounded-l-none border border-[color:var(--destructive)]/60 bg-gradient-to-b from-[#3f0d1d]/40 to-[#25060f]/60 p-2 transition active:scale-[0.98]"
            >
              <span className="mx-auto rounded-md bg-[color:var(--destructive)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                {rnd ? "Random Opponent" : "Opponent"}
              </span>
              <div className="mt-2 aspect-[9/14] w-full overflow-hidden rounded-xl bg-black/40">
                {rnd?.host?.avatar ? (
                  <img src={rnd.host.avatar} className="h-full w-full object-cover" alt={rnd.host?.username ?? "opponent"} />
                ) : (
                  <div className="grid h-full w-full place-items-center text-center text-white/50">
                    {hostsQ.isLoading ? (
                      <span className="text-[11px]">Finding live hosts…</span>
                    ) : rnd ? (
                      <span className="text-4xl font-black uppercase">{(rnd.host?.username ?? "?").charAt(0)}</span>
                    ) : (
                      <div className="flex flex-col items-center gap-1 px-2">
                        <Users className="h-6 w-6" />
                        <span className="text-[11px]">No live hosts right now</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 truncate text-center text-[13px] font-bold">
                {rnd?.host?.username ?? "—"}
              </div>
              {rnd && (
                <div className="mt-1 text-center text-[9.5px] uppercase tracking-wider text-white/40">
                  Tap to match • Swipe up for next
                </div>
              )}
            </div>
          );

        })()}


      </div>

      {/* PK MODE removed — shown as popup on Start PK Battle */}


      {/* Stake (Entry) moved into the Start PK Battle popup */}



      {/* Winner banner */}
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-white/5 bg-gradient-to-r from-[#1a0625]/70 to-[#0d0620]/70 px-3 py-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--destructive)]/20">
          <Gift className="h-5 w-5 text-[color:var(--destructive)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold">Winner will get the stakes + gifts</div>
          <div className="text-[11px] text-white/50">Be respectful and enjoy the PK!</div>
        </div>
        <Trophy className="h-6 w-6 text-[color:var(--gold)]" />
      </div>

      {/* Gloves match button moved between VS panels above */}

      {match?.status === "active" && (
        <div className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--primary)]/40 bg-gradient-to-r from-sky-500/20 via-fuchsia-500/20 to-pink-500/20 py-3 text-[13px] font-bold uppercase tracking-wider text-white">
          <Zap className="h-4 w-4" /> PK Live
        </div>
      )}






      {/* Live score bar when match active */}
      {match?.status === "active" && (
        <section className="mx-3 mt-3 rounded-2xl border border-white/10 bg-black/50 p-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px] font-bold">
            <span className="text-sky-300">{hostSideScore.toLocaleString()}</span>
            <span className="text-white/40">LIVE</span>
            <span className="text-pink-300">{oppSideScore.toLocaleString()}</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 to-blue-500"
              style={{ width: `${hostPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-pink-400 to-fuchsia-500"
              style={{ width: `${100 - hostPct}%` }}
            />
          </div>
        </section>
      )}

      {/* Chat */}
      <section className="mx-3 mt-4 flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
        <div className="mb-2">
          <h2 className="text-[13px] font-bold">
            <span className="border-b-2 border-[color:var(--primary)] pb-1">Chat</span>
          </h2>
        </div>
        <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
          {(chatQ.data ?? []).map((m: any) => (
            <div key={m.id} className="flex items-start gap-2 text-[12px]">
              {m.profiles?.avatar ? (
                <img src={m.profiles.avatar} className="mt-0.5 h-6 w-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-bold uppercase text-white/70">
                  {(m.profiles?.username ?? "?").charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="mr-1 font-semibold text-white/80">{m.profiles?.username ?? "user"}</span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-white/90">{m.body}</span>
              </div>
              <span className="whitespace-nowrap text-[10px] text-white/40">
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {(!chatQ.data || chatQ.data.length === 0) && (
            <div className="py-6 text-center text-[11px] text-white/40">No messages yet — say hi 👋</div>
          )}
        </div>
      </section>

      {/* Composer — sticky above bottom action bar */}
      <div className="sticky bottom-[64px] z-20 mx-3 mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          placeholder="Type a message..."
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/40"
        />
        <button className="text-white/60"><Smile className="h-5 w-5" /></button>
        <button
          onClick={sendMessage}
          className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--primary)] text-white"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 z-30 mt-2 grid grid-cols-[repeat(5,1fr)_auto] items-center gap-2 border-t border-white/5 bg-black/70 px-3 py-2 backdrop-blur">
        <ActionBtn
          icon={isHost ? (agora.muted ? MicOff : Mic) : Mic}
          label={isHost ? (agora.muted ? "Unmute" : "Mute") : "Mic"}
          active={isHost && !agora.muted && !!agora.localAudioPublished.current}
          danger={isHost && agora.muted}
          onClick={async () => {
            if (!isHost) return toast.info("Only host controls the mic");
            if (agora.micBlocked || !agora.localAudioTrack.current || !agora.localAudioPublished.current) {
              const r = await agora.requestMic();
              if (!r.ok) return toast.error(r.error ?? agora.micError ?? "Microphone unavailable");
            }
            await agora.toggleMute();
          }}
        />
        <ActionBtn
          icon={isHost ? (agora.videoOn ? Video : VideoOff) : Video}
          label={isHost ? (agora.videoOn ? "Camera" : "Cam Off") : "Cam"}
          active={isHost && !!agora.videoOn}
          danger={isHost && !agora.videoOn}
          onClick={async () => {
            if (!isHost) return toast.info("Only host controls the camera");
            try { await agora.toggleVideo(); } catch { toast.error("Camera unavailable"); }
          }}
        />
        <ActionBtn
          icon={agora.speakerMuted ? VolumeX : Volume2}
          label={agora.speakerMuted ? "Muted" : "Sound"}
          active={!agora.speakerMuted}
          danger={agora.speakerMuted}
          onClick={() => agora.toggleSpeaker()}
        />
        <ActionBtn icon={Gift} label="Gift" onClick={() => navigate({ to: "/room/$roomId", params: { roomId } })} />
        <ActionBtn icon={MoreHorizontal} label="Rules" onClick={() => setRulesOpen(true)} />
        <button
          onClick={() => navigate({ to: "/room/$roomId", params: { roomId } })}
          className="flex items-center gap-1.5 rounded-full border border-[color:var(--secondary)]/60 bg-[color:var(--secondary)]/10 px-3.5 py-2 text-[12px] font-bold text-white"
        >
          <Hand className="h-4 w-4 text-[color:var(--gold)]" /> Live Room

        </button>
      </div>

      {/* Opponent Picker Sheet */}
      {pickerOpen && (
        <Sheet
          onClose={() => { setPickerOpen(false); setPickerMode("choice"); }}
          title={pickerMode === "choice" ? "Select Opponent" : pickerMode === "random" ? "Random Opponent" : "Pick a Host"}
        >
          {pickerMode === "choice" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const list = hostsQ.data ?? [];
                  setRandomIdx(list.length ? Math.floor(Math.random() * list.length) : 0);
                  setPickerMode("random");
                }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[color:var(--primary)]/50 bg-gradient-to-b from-[#3a0d3f]/40 to-[#1a0625]/60 p-5 active:scale-95"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--primary)]/25">
                  <Shuffle className="h-6 w-6 text-[color:var(--primary)]" />
                </div>
                <span className="text-[14px] font-bold">Random Find</span>
                <span className="text-[11px] text-white/50">Match with a random host</span>
              </button>
              <button
                onClick={() => setPickerMode("pick")}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[color:var(--secondary)]/50 bg-gradient-to-b from-[#1a0b2e]/60 to-[#0d0620]/60 p-5 active:scale-95"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--secondary)]/25">
                  <Users className="h-6 w-6 text-[color:var(--secondary)]" />
                </div>
                <span className="text-[14px] font-bold">Pick Host</span>
                <span className="text-[11px] text-white/50">Browse & choose yourself</span>
              </button>
            </div>
          )}

          {pickerMode === "random" && (() => {
            const list = hostsQ.data ?? [];
            const h = list[randomIdx];
            if (!list.length) {
              return <div className="py-10 text-center text-[12px] text-white/40">No live opponents right now</div>;
            }
            return (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {h.host?.avatar ? (
                    <img src={h.host.avatar} className="h-28 w-28 rounded-2xl object-cover ring-2 ring-[color:var(--primary)]/60" alt="" />
                  ) : (
                    <div className="grid h-28 w-28 place-items-center rounded-2xl bg-white/10 text-3xl font-black uppercase text-white/70 ring-2 ring-[color:var(--primary)]/60">
                      {(h.host?.username ?? "?").charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--destructive)] px-2 py-0.5 text-[10px] font-bold uppercase">Live</span>
                </div>
                <div className="mt-2 text-center">
                  <div className="text-[15px] font-bold">{h.host?.username ?? "Host"}</div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-white/50">
                    <Users className="h-3 w-3" /> {h.viewer_count ?? 0} viewers
                  </div>
                </div>
                <div className="mt-2 grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const next = list.length ? (randomIdx + 1 + Math.floor(Math.random() * Math.max(1, list.length - 1))) % list.length : 0;
                      setRandomIdx(next);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white/80 active:scale-95"
                  >
                    <SkipForward className="h-4 w-4" /> Next
                  </button>
                  <button
                    onClick={() => { setOpponent(h); setPickerOpen(false); setPickerMode("choice"); setModeSheetOpen(true); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-fuchsia-500 py-2.5 text-[13px] font-bold text-white active:scale-95"
                  >
                    <Check className="h-4 w-4" /> Match
                  </button>
                </div>
                <button
                  onClick={() => setPickerMode("choice")}
                  className="mt-1 text-[11px] text-white/40 underline"
                >
                  Back
                </button>
              </div>
            );
          })()}

          {pickerMode === "pick" && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {(hostsQ.data ?? []).map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setOpponent(h); setPickerOpen(false); setPickerMode("choice"); setModeSheetOpen(true); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 hover:bg-white/[0.06]"
                >
                  {h.host?.avatar ? (
                    <img src={h.host.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[13px] font-bold uppercase text-white/70">
                      {(h.host?.username ?? "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-bold">{h.host?.username ?? "Host"}</div>
                    <div className="truncate text-[11px] text-white/50">{h.title ?? "Live"}</div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-white/60">
                    <Users className="h-3 w-3" /> {h.viewer_count ?? 0}
                  </span>
                </button>
              ))}
              {hostsQ.data && hostsQ.data.length === 0 && (
                <div className="py-10 text-center text-[12px] text-white/40">No live opponents right now</div>
              )}
              <button
                onClick={() => setPickerMode("choice")}
                className="mt-1 w-full text-center text-[11px] text-white/40 underline"
              >
                Back
              </button>
            </div>
          )}
        </Sheet>
      )}

      {/* PK Mode Picker Sheet */}
      {modeSheetOpen && (
        <Sheet onClose={() => setModeSheetOpen(false)} title="Select PK Mode">
          {/* Stake entry — pick or type coins to stake */}
          <div className="mb-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
              Stake (Entry) • Balance {(profile?.coins ?? 0).toLocaleString()}
            </h3>
            <div className="grid grid-cols-5 gap-1.5">
              {STAKES.map((s) => {
                const active = !customOpen && stake === s;
                return (
                  <button
                    key={s}
                    onClick={() => { setCustomOpen(false); setStake(s); }}
                    className={`rounded-lg border px-1 py-2 text-[12px] font-bold transition ${
                      active
                        ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                        : "border-white/15 bg-white/5 text-white/80"
                    }`}
                  >
                    {s >= 1000 ? `${s / 1000}k` : s}
                  </button>
                );
              })}
              <button
                onClick={() => setCustomOpen((v) => !v)}
                className={`rounded-lg border px-1 py-2 text-[12px] font-bold transition ${
                  customOpen
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                    : "border-white/15 bg-white/5 text-white/80"
                }`}
              >
                Custom
              </button>
            </div>
            {customOpen && (
              <input
                type="number"
                inputMode="numeric"
                placeholder="Enter coins"
                value={customStake}
                onChange={(e) => setCustomStake(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[color:var(--gold)] focus:outline-none"
              />
            )}
            <p className="mt-1.5 text-[10.5px] text-white/50">
              Stake: <span className="font-bold text-[color:var(--gold)]">{effectiveStake.toLocaleString()}</span> coins • Winner takes the pot
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MODE_META) as PkMode[]).map((k) => {
              const meta = MODE_META[k];
              const Icon = meta.icon;
              return (
                <button
                  key={k}
                  onClick={() => void startBattle(k)}
                  disabled={starting}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border bg-gradient-to-b ${meta.accent} p-3 text-center transition active:scale-95 disabled:opacity-60`}
                >
                  <Icon className="h-7 w-7 text-white" />
                  <span className="text-[13px] font-bold">{meta.label}</span>
                  <span className="text-[11px] text-white/70">{meta.minutes} Minutes</span>
                  <span className="text-[10px] text-white/50">{meta.sub}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-white/50">
            Time select karte hi match {opponent?.host?.username ?? "opponent"} ko challenge chala jayega.
          </p>
        </Sheet>

      )}

      {/* Rules Sheet */}
      {rulesOpen && (
        <Sheet onClose={() => setRulesOpen(false)} title="PK Rules">
          <ul className="space-y-3 text-[13px] text-white/80">
            <li className="flex gap-2"><Swords className="mt-0.5 h-4 w-4 text-[color:var(--gold)]" /> Both hosts fight for gift coins during a timed round.</li>
            <li className="flex gap-2"><Trophy className="mt-0.5 h-4 w-4 text-[color:var(--gold)]" /> The host with more gift coins wins the round and takes the stake pool.</li>
            <li className="flex gap-2"><Shield className="mt-0.5 h-4 w-4 text-[color:var(--gold)]" /> Bad words / harassment result in an immediate loss and ban.</li>
            <li className="flex gap-2"><Timer className="mt-0.5 h-4 w-4 text-[color:var(--gold)]" /> Round length is set by mode: Quick 3m, Normal 5m, Challenge 10m.</li>
          </ul>
        </Sheet>
      )}

      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent className="border-violet-400/30 bg-gradient-to-b from-[#1a0b2e] to-[#050505] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {isHost ? "Close the PK room?" : "Leave the PK room?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              {isHost
                ? "Yeh PK room band ho jayega aur active match end ho jayega. Sure?"
                : "Kya aap is PK room say bahar jana chahtay hain?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Nahi
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doExit();
              }}
              className="bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:opacity-90"
            >
              {isHost ? "Haan, band karo" : "Haan, exit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {exiting && (
        <div className="pointer-events-none fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md animate-in fade-in duration-500" />
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, active, danger }: { icon: any; label: string; onClick?: () => void; active?: boolean; danger?: boolean }) {
  const tone = danger
    ? "text-rose-300"
    : active
      ? "text-emerald-300"
      : "text-white/70";
  const ring = danger
    ? "bg-rose-500/15 ring-1 ring-rose-400/40"
    : active
      ? "bg-emerald-500/15 ring-1 ring-emerald-400/40"
      : "bg-white/[0.04] ring-1 ring-white/10";
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 active:scale-95 ${tone}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-full ${ring}`}>
        <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

function HostPanel({
  label,
  username,
  avatar,
  coins: _coins,
  accentClass,
  crown: _crown,
  videoTrack,
  mirror,
  micOn,
  camOn,
}: {
  label: string;
  username: string;
  avatar: string | null | undefined;
  coins: number;
  accentClass: string;
  crown?: boolean;
  videoTrack?: { play: (el: HTMLElement, opts?: { fit?: "cover" | "contain" }) => void; stop: () => void } | null;
  mirror?: boolean;
  micOn?: boolean;
  camOn?: boolean;
}) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    try { videoTrack.play(el, { fit: "cover" }); } catch { /* ignore */ }
    return () => { try { videoTrack.stop(); } catch { /* ignore */ } };
  }, [videoTrack]);

  const showCamOff = camOn === false;
  const showMicOff = micOn === false;

  return (
    <div className={`relative flex flex-col items-center overflow-hidden rounded-2xl border p-2 ${accentClass}`}>
      {label.includes("OPPONENT") && (
        <span className="rounded-md bg-[color:var(--destructive)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          {label}
        </span>
      )}
      <div className={`${label.includes("OPPONENT") ? "mt-2" : ""} relative aspect-[9/14] w-full overflow-hidden rounded-xl bg-black/40`}>
        {videoTrack && !showCamOff ? (
          <div
            ref={videoRef}
            className="absolute inset-0 h-full w-full"
            style={mirror ? { transform: "scaleX(-1)" } : undefined}
          />
        ) : avatar ? (
          <img src={avatar} className="h-full w-full object-cover" alt={username} />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl font-black uppercase text-white/60">
            {(username ?? "?").charAt(0)}
          </div>
        )}

        {showCamOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[2px]">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-black/60 ring-1 ring-white/20">
              <VideoOff className="h-5 w-5 text-white/85" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Camera Off</span>
          </div>
        )}

        {(micOn !== undefined || camOn !== undefined) && (
          <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
            {micOn !== undefined && (
              <span
                className={`grid h-6 w-6 place-items-center rounded-full ring-1 backdrop-blur ${
                  micOn ? "bg-emerald-500/80 ring-emerald-200/40" : "bg-rose-600/85 ring-rose-200/40"
                }`}
                title={micOn ? "Mic on" : "Muted"}
              >
                {micOn ? <Mic className="h-3.5 w-3.5 text-white" /> : <MicOff className="h-3.5 w-3.5 text-white" />}
              </span>
            )}
            {camOn !== undefined && (
              <span
                className={`grid h-6 w-6 place-items-center rounded-full ring-1 backdrop-blur ${
                  camOn ? "bg-sky-500/80 ring-sky-200/40" : "bg-zinc-800/85 ring-white/20"
                }`}
                title={camOn ? "Camera on" : "Camera off"}
              >
                {camOn ? <Video className="h-3.5 w-3.5 text-white" /> : <VideoOff className="h-3.5 w-3.5 text-white" />}
              </span>
            )}
          </div>
        )}

        {(showMicOff || showCamOff) && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 ring-1 ring-white/10">
            {showMicOff && <MicOff className="h-3 w-3 text-rose-300" />}
            {showCamOff && <VideoOff className="h-3 w-3 text-white/70" />}
            <span>{showMicOff && showCamOff ? "Offline" : showMicOff ? "Muted" : "No Cam"}</span>
          </div>
        )}
      </div>
      <div className="mt-2 truncate text-[13px] font-bold">{username}</div>
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#1a0b2e] to-[#0d0620] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <h3 className="mb-3 text-center text-[15px] font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
