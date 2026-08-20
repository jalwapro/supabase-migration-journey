import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useZegoRoom as useAgoraRoom } from "@/hooks/useZegoRoom";
import { useRoomHeartbeat } from "@/hooks/useRoomHeartbeat";
import { PKScreen } from "@/components/voice-room/PKScreen";

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
  useRoomHeartbeat(room?.id, isHost);
  const activeMatchId: string | null = room?.active_pk_match_id ?? null;
  const rtcChannel = activeMatchId ? `pk-${activeMatchId}` : room?.rtc_channel ?? null;

  // ── Live audio + video via Zego ───────────────────────────────
  const myUid = user ? uidFromUuid(user.id) : null;
  const agora = useAgoraRoom({
    channel: rtcChannel,
    uid: myUid,
    publish: isHost,
    video: true,
    kind: "pk",
    enabled: !!user && !!rtcChannel,
  });

  // Active match if any
  const matchQ = useQuery({
    enabled: !!activeMatchId,
    queryKey: ["pk-match", activeMatchId],
    staleTime: 15_000,
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

  const followPendingRef = useRef(false);
  async function toggleFollow() {
    if (!user || !room) return;
    if (followPendingRef.current) return; // guard rapid double-taps
    followPendingRef.current = true;
    try {
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
      await followQ.refetch();
    } finally {
      followPendingRef.current = false;
    }
  }


  // Incoming pending invites addressed to me.
  // Only surface invites that were CREATED after this room mount — reopening
  // the room should not re-show a stale challenge the user ignored earlier.
  const mountedAtRef = useRef<string>(new Date().toISOString());
  const incomingQ = useQuery({
    enabled: !!user && isHost,
    queryKey: ["pk-incoming", user?.id, roomId],
    staleTime: 15_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("pk_invites")
        .select("id,from_host,from_room,duration_sec,expires_at,status,stake_coins,created_at")
        .eq("to_host", user!.id)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .gt("created_at", mountedAtRef.current)
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

  // Sweep stale pending invites in DB once on mount so old rows don't linger.
  useEffect(() => {
    if (!user || !isHost) return;
    void supabase.rpc("pk_expire_stale_invites").then(() => incomingQ.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isHost]);

  // Realtime: any change to pk_invites addressed to me → refetch incoming.
  // Auto-resubscribe on CHANNEL_ERROR / TIMED_OUT / CLOSED (transient network drop).
  useEffect(() => {
    if (!user?.id) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;
    const connect = () => {
      if (cancelled) return;
      ch = supabase
        .channel(`pk-invites:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pk_invites", filter: `to_host=eq.${user.id}` },
          () => { incomingQ.refetch(); },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (ch) { void supabase.removeChannel(ch); ch = null; }
            if (!cancelled) {
              // Exponential backoff w/ jitter, capped at 30s
              const delay = Math.min(30_000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
              attempt = Math.min(attempt + 1, 5);
              retryTimer = setTimeout(connect, delay);
            }
          } else if (status === "SUBSCRIBED") {
            attempt = 0;
            incomingQ.refetch();
          }
        });
    };
    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ch) void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Realtime: pk_matches / live_rooms changes for THIS room → refetch.
  // Server-side room_id filter avoids receiving unrelated match events.
  useEffect(() => {
    if (!roomId) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      ch = supabase
        .channel(`pk-matches:${roomId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pk_matches", filter: `room_id=eq.${roomId}` },
          () => { matchQ.refetch(); roomQ.refetch(); },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` },
          () => { roomQ.refetch(); },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (ch) { void supabase.removeChannel(ch); ch = null; }
            if (!cancelled) {
              const delay = Math.min(30_000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
              attempt = Math.min(attempt + 1, 5);
              retryTimer = setTimeout(connect, delay);
            }
          } else if (status === "SUBSCRIBED") {
            attempt = 0;
            matchQ.refetch();
            roomQ.refetch();
          }
        });


    };
    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ch) void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);


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
      void supabase
        .rpc("pk_end_match", { _match_id: match.id })
        .then(({ error }) => {
          if (error) {
            // Allow retry from this tab on network/transient failure
            endTriggeredRef.current = null;
            return;
          }
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

  function openStartFlow(preselect?: LiveHost | null) {
    if (!isHost) return toast.error("Only the host can start a PK");
    const target = preselect ?? opponent;
    if (!target) {
      setPickerOpen(true);
      return;
    }
    if (preselect && preselect !== opponent) setOpponent(preselect);
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
    const { error } = await supabase.rpc("pk_send_invite", {
      _to_host: opponent.host_id,
      _duration_sec: MODE_META[chosenMode].sec,
      _stake_coins: effectiveStake,
    } as any);
    if (error) {
      setStarting(false);
      return toast.error(error.message);
    }
    setStarting(false);
    toast.success(`Challenge sent to ${opponent.host?.username ?? "opponent"} — ${MODE_META[chosenMode].minutes} min${effectiveStake > 0 ? ` · ${effectiveStake} coins staked` : ""}`);
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

  async function togglePkMic() {
    if (!isHost) return toast.info("Only host controls the mic");
    if (!rtcChannel) return toast.info("Room ready nahi hai — thodi der ruk kar dobara try karein");
    if (agora.status === "error" || agora.status === "disabled") {
      return toast.error(agora.error ?? "Voice service unavailable");
    }
    // If mic isn't up yet (or is blocked), request it — requestMic() itself
    // waits internally until Zego reaches CONNECTED, so no pre-guard needed.
    if (agora.micBlocked || !agora.localAudioTrack.current || !agora.localAudioPublished.current) {
      const pending = toast.loading("Mic start ho raha hai…");
      const result = await agora.requestMic();
      toast.dismiss(pending);
      if (!result.ok) {
        const message = result.error ?? agora.micError ?? "Microphone unavailable";
        const permissionIssue = /permission|blocked|allow|browser settings|site settings/i.test(message);
        toast.error(message, {
          description: permissionIssue
            ? "Browser ke address bar me 🔒/ⓘ par tap karein → Site settings → Microphone → Allow."
            : "Mic kisi aur app me use ho raha ho to band karke dobara try karein.",
          duration: 8000,
        });
        return;
      }
      toast.success("Microphone enabled");
      return;
    }
    await agora.toggleMute();
  }

  async function togglePkCamera() {
    if (!isHost) return toast.info("Only host controls the camera");
    if (!rtcChannel) return toast.info("Room ready nahi hai — thodi der ruk kar dobara try karein");
    if (agora.status === "error" || agora.status === "disabled") {
      return toast.error(agora.error ?? "Voice service unavailable");
    }
    const turningOn = !agora.videoOn;
    const pending = turningOn ? toast.loading("Camera start ho raha hai…") : null;
    const ok = await agora.toggleVideo();
    if (pending) toast.dismiss(pending);
    if (!ok) {
      toast.error(agora.micError ?? "Camera unavailable", {
        description: "Browser ke address bar me 🔒/ⓘ par tap karein → Site settings → Camera → Allow.",
        duration: 8000,
      });
      return;
    }
    toast.success(turningOn ? "Camera enabled" : "Camera off");
  }


  const hostSideScore = scoreQ.data?.score_a ?? 0;
  const oppSideScore = scoreQ.data?.score_b ?? 0;
  const totalScore = hostSideScore + oppSideScore;
  const hostPct = totalScore > 0 ? Math.round((hostSideScore / totalScore) * 100) : 50;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-gradient-to-b from-[#0a0416] via-[#0d0620] to-black text-white">
      <div className="relative z-10 mx-auto w-full max-w-md px-3 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setExitConfirmOpen(true)} className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-400/50 bg-gradient-to-br from-rose-500/30 via-rose-600/20 to-black/60 text-white shadow-[0_0_16px_-2px_rgba(244,63,94,0.6)] backdrop-blur-md active:scale-90">
            <DoorOpen className="h-5 w-5 text-rose-200" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="truncate text-[15px] font-black text-white">{room?.title || "PK Room"}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/50 font-bold">
               <Users className="h-3 w-3" /> {room?.viewer_count || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-3 mt-4 flex items-stretch">
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl rounded-r-none border border-sky-500/60 bg-gradient-to-b from-[#0d1d3f]/40 to-[#060f25]/60 p-2">
          <span className="rounded-md bg-sky-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>
          <div className="mt-2 aspect-[9/14] w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
            {room?.host?.avatar ? <img src={room.host.avatar} className="h-full w-full object-cover" alt="" /> : <div className="grid h-full w-full place-items-center text-4xl font-black text-white/50">{(room?.host?.username || "?")[0]}</div>}
            <div id="pk-video-local" className="absolute inset-0 z-10" />
          </div>
          <div className="mt-2 truncate text-center text-[13px] font-bold text-sky-400">{room?.host?.username || "Host"}</div>
        </div>

        <div className="z-10 -mx-3 flex w-16 flex-col items-center justify-center gap-3 self-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.5)] outline outline-2 outline-black">
            <span className="text-[13px] font-black italic text-white">VS</span>
          </div>
          {match?.status === "active" && <div className="flex flex-col items-center rounded-lg bg-black/60 px-2 py-1 text-[11px] font-black text-white outline outline-1 outline-white/10"><Timer className="mb-0.5 h-3 w-3 text-rose-400" />{fmt(endsInSec ?? 0)}</div>}
        </div>

        {match?.status === "active" ? (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl rounded-l-none border border-rose-500/60 bg-gradient-to-b from-[#3f0d3f]/40 to-[#250625]/60 p-2">
            <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Opponent</span>
            <div className="mt-2 aspect-[9/14] w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
              {opponentQ.data?.avatar ? <img src={opponentQ.data.avatar} className="h-full w-full object-cover" alt="" /> : <div className="grid h-full w-full place-items-center text-4xl font-black text-white/50">{(opponentQ.data?.username || "?")[0]}</div>}
              <div id="pk-video-remote" className="absolute inset-0 z-10" />
            </div>
            <div className="mt-2 truncate text-center text-[13px] font-bold text-rose-400">{opponentQ.data?.username || "Opponent"}</div>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl rounded-l-none border border-white/10 bg-white/5 p-2">
            <span className="text-[10px] text-white/40">Waiting for Opponent</span>
          </div>
        )}
      </div>

      {match?.status === "active" && (
        <div className="mx-3 mt-4">
          <PKScreen match={match} score={{ score_a: hostSideScore, score_b: oppSideScore }} host={room?.host} opponent={opponentQ.data} endsInSec={endsInSec} isHost={isHost} />
        </div>
      )}

      <section className="mx-3 mt-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {(chatQ.data ?? []).map((m: any) => (
            <div key={m.id} className="flex items-start gap-2 text-[12px]">
              <div className="min-w-0 flex-1">
                <span className="mr-1 font-black text-sky-400">{m.profiles?.username ?? "user"}:</span>
                <span className="text-white/90">{m.body}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-3 my-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
        <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder="Type a message..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
        <button onClick={sendMessage} className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white"><Send className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-white/5 bg-black/70 px-3 py-2 backdrop-blur">
        <ActionBtn icon={isHost ? (agora.muted ? MicOff : Mic) : Mic} label={isHost ? (agora.muted ? "Unmute" : "Mute") : "Mic"} active={isHost && !agora.muted} danger={isHost && agora.muted} onClick={() => void togglePkMic()} />
        <ActionBtn icon={isHost ? (agora.videoOn ? Video : VideoOff) : Video} label={isHost ? (agora.videoOn ? "Cam On" : "Cam Off") : "Cam"} active={isHost && !!agora.videoOn} danger={isHost && !agora.videoOn} onClick={() => void togglePkCamera()} />
        <ActionBtn icon={Gift} label="Gift" onClick={() => navigate({ to: "/room/$roomId", params: { roomId } })} />
        {isHost ? (
          <button onClick={() => match?.status === "active" ? void supabase.rpc("pk_end_match", { _match_id: match.id }).then(() => { matchQ.refetch(); roomQ.refetch(); }) : openStartFlow()} className="flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-[12px] font-black text-white px-2 py-2">
            <Swords className="h-4 w-4" /> {match?.status === "active" ? "End PK" : "Start PK"}
          </button>
        ) : (
          <ActionBtn icon={MoreHorizontal} label="Rules" onClick={() => setRulesOpen(true)} />
        )}
      </div>

      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent className="border-white/10 bg-[#1a0625] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Room?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">Battle progress might be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doExit} className="bg-rose-600 text-white">Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    let stopped = false;
    try { videoTrack.play(el, { fit: "cover" }); } catch { /* ignore */ }
    return () => {
      if (stopped) return;
      stopped = true;
      try { videoTrack.stop(); } catch { /* ignore */ }
    };
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
