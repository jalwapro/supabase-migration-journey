import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgoraRoom, type RemoteUser } from "@/hooks/useAgoraRoom";
import {
  Flag,
  Share2,
  Power,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Gift,
  Send,
  User as UserIcon,
  Heart,
  Trophy,
  Users,
  Smile,
  Gamepad2,
  Settings,
  Music,
  Flame,
  Sparkles,
  Plus,
  Minus,
  Crown,
  ChevronRight,
  UserPlus,
  Lock,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
import { LudoSheet, type LudoPlayer } from "@/components/room/LudoSheet";
import { HostMusicPlayer } from "@/components/room/HostMusicPlayer";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});

type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  room_type: "voice" | "video";
  status: "live" | "ended";
  viewer_count: number;
  seat_count: number;
  host_id: string;
  agora_channel: string;
  host: { username: string | null; avatar: string | null } | null;
};

type Member = {
  room_id: string;
  user_id: string;
  seat_index: number | null;
  is_muted: boolean;
  is_video: boolean;
  user: { username: string | null; avatar: string | null } | null;
};

type Message = {
  id: string;
  user_id: string | null;
  kind: string;
  text: string | null;
  created_at: string;
  user: { username: string | null; avatar: string | null } | null;
};

// Deterministic 31-bit int from uuid for Agora uid
function uidFromUuid(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 2_000_000_000) + 1;
}

function shortRoomCode(id: string) {
  // Deterministic 7-char display code
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const num = Math.abs(h) % 10_000_000;
  return "C" + String(num).padStart(7, "0");
}

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [ludoOpen, setLudoOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [seatsSheetOpen, setSeatsSheetOpen] = useState(false);

  const [chatTab, setChatTab] = useState<"all" | "chat">("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [liked, setLiked] = useState(false);
  const [roomPoints, setRoomPoints] = useState(0);

  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,status,viewer_count,seat_count,host_id,agora_channel,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("id", roomId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Room | null;
    },
  });

  const isHost = user?.id === room.data?.host_id;
  const myUid = user ? uidFromUuid(user.id) : null;
  const myMember = members.find((m) => m.user_id === user?.id) ?? null;
  const iAmOnSeat = myMember?.seat_index != null;
  const shouldPublish = isHost || iAmOnSeat;

  const agora = useAgoraRoom({
    channel: room.data?.agora_channel ?? null,
    uid: myUid,
    publish: shouldPublish,
    video: room.data?.room_type === "video",
    enabled: !!user && !!room.data && room.data.status === "live",
  });

  // Load initial members + messages
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: mData }, { data: msgData }] = await Promise.all([
        supabase
          .from("room_members")
          .select(
            "room_id,user_id,seat_index,is_muted,is_video,user:profiles!room_members_user_id_fkey(username,avatar)",
          )
          .eq("room_id", roomId),
        supabase
          .from("room_messages")
          .select(
            "id,user_id,kind,text,created_at,user:profiles!room_messages_user_id_fkey(username,avatar)",
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancel) return;
      setMembers((mData ?? []) as unknown as Member[]);
      setMessages(((msgData ?? []) as unknown as Message[]).reverse());
    })();
    return () => {
      cancel = true;
    };
  }, [roomId]);

  // Realtime: chat + members
  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row = payload.new as Message;
          if (row.user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("username,avatar")
              .eq("id", row.user_id)
              .maybeSingle();
            row.user = (data as Message["user"]) ?? null;
          }
          setMessages((prev) => [...prev.slice(-99), row]);
          if (row.kind === "gift") setRoomPoints((n) => n + 10);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("room_members")
            .select(
              "room_id,user_id,seat_index,is_muted,is_video,user:profiles!room_members_user_id_fkey(username,avatar)",
            )
            .eq("room_id", roomId);
          setMembers((data ?? []) as unknown as Member[]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Join as viewer (or seat 0 if host) on mount
  useEffect(() => {
    if (!user || !room.data) return;
    const seatIndex = isHost ? 0 : null;
    void supabase
      .from("room_members")
      .upsert(
        { room_id: roomId, user_id: user.id, seat_index: seatIndex },
        { onConflict: "room_id,user_id" },
      );
    return () => {
      void supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    };
  }, [user, room.data, roomId, isHost]);

  // Does current user follow the host? (host is exempt)
  const followsHost = useQuery({
    enabled: !!user && !!room.data?.host_id && user?.id !== room.data?.host_id,
    queryKey: ["follows-host", user?.id, room.data?.host_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", room.data!.host_id)
        .maybeSingle();
      return !!data;
    },
  });

  async function followHost() {
    if (!user || !room.data) return;
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: room.data.host_id });
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }
    toast.success("Following host — you can join a seat now");
    followsHost.refetch();
  }

  async function takeSeat(seatIndex: number) {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (seatIndex === 0 && !isHost) {
      toast.error("Seat 1 is for the host");
      return;
    }
    if (!isHost && !followsHost.data) {
      toast.error("Follow the host to join a seat", {
        action: { label: "Follow", onClick: () => void followHost() },
      });
      return;
    }
    const { error } = await supabase
      .from("room_members")
      .upsert(
        { room_id: roomId, user_id: user.id, seat_index: seatIndex },
        { onConflict: "room_id,user_id" },
      );
    if (error) toast.error(error.message);
  }

  async function leaveSeat() {
    if (!user) return;
    const { error } = await supabase
      .from("room_members")
      .update({ seat_index: null })
      .eq("room_id", roomId)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
  }

  async function changeSeatCount(delta: number) {
    if (!isHost || !room.data) return;
    const next = Math.max(4, Math.min(20, room.data.seat_count + delta));
    if (next === room.data.seat_count) return;
    // If shrinking, kick anyone on seats >= next
    if (next < room.data.seat_count) {
      await supabase
        .from("room_members")
        .update({ seat_index: null })
        .eq("room_id", roomId)
        .gte("seat_index", next);
    }
    const { error } = await supabase
      .from("live_rooms")
      .update({ seat_count: next })
      .eq("id", roomId);
    if (error) {
      toast.error(error.message);
      return;
    }
    room.refetch();
  }

  async function send() {
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    const v = text.trim();
    if (!v) return;
    setText("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      kind: "chat",
      text: v,
    });
    if (error) {
      toast.error(error.message);
      setText(v);
    }
  }

  async function leaveRoom() {
    if (user && isHost) {
      await supabase
        .from("live_rooms")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", roomId);
    }
    navigate({ to: "/" });
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: room.data?.title ?? "Live Room" });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Room link copied");
  }

  const seatsByIndex = useMemo(() => {
    const m = new Map<number, Member>();
    members.forEach((x) => {
      if (x.seat_index != null) m.set(x.seat_index, x);
    });
    return m;
  }, [members]);

  const seatedCount = useMemo(
    () => members.filter((m) => m.seat_index != null).length,
    [members],
  );

  const ludoPlayers: LudoPlayer[] = [0, 1, 2, 3].map((i) => {
    const m = seatsByIndex.get(i);
    return m
      ? { id: m.user_id, username: m.user?.username ?? null, avatar: m.user?.avatar ?? null }
      : { id: `empty-${i}`, username: null, avatar: null };
  });

  function openLudo() {
    if (seatedCount < 4) {
      toast.error(`Ludo needs 4 users on seats (currently ${seatedCount})`);
      return;
    }
    setLudoOpen(true);
  }

  if (room.isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Loading room…</div>
      </div>
    );
  }
  if (!room.data) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground">This room doesn't exist.</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  const r = room.data;
  const roomCode = shortRoomCode(r.id);
  const giftReceivers: GiftReceiver[] = [
    ...(r.host && r.host_id !== user?.id
      ? [{ id: r.host_id, username: r.host.username, avatar: r.host.avatar }]
      : []),
    ...members
      .filter((m) => m.seat_index != null && m.user_id !== user?.id && m.user_id !== r.host_id)
      .map((m) => ({
        id: m.user_id,
        username: m.user?.username ?? null,
        avatar: m.user?.avatar ?? null,
      })),
  ];

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(1000px 600px at 50% -20%, color-mix(in oklab, var(--primary) 55%, transparent), transparent 60%), radial-gradient(800px 500px at 100% 100%, color-mix(in oklab, var(--destructive) 30%, transparent), transparent 70%), linear-gradient(180deg, #1a0b2e 0%, #0b0716 100%)",
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40"
        style={{
          background:
            "radial-gradient(400px 200px at 30% 20%, color-mix(in oklab, var(--gold) 40%, transparent), transparent), radial-gradient(400px 200px at 70% 30%, color-mix(in oklab, var(--secondary) 40%, transparent), transparent)",
        }}
      />

      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto flex w-full max-w-md items-center gap-2 px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        {/* Host chip */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-2 backdrop-blur-md">
          <div className="relative h-9 w-9 shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--destructive)] p-[2px]">
              <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#1a0b2e]">
                {r.host?.avatar ? (
                  <img src={r.host.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </div>
            </div>
            <Crown className="absolute -top-1 -right-0.5 h-3.5 w-3.5 fill-[color:var(--gold)] text-[color:var(--gold)] drop-shadow" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1">
              <span className="truncate text-[12px] font-extrabold">
                {r.host?.username ?? "Host"}
              </span>
              {(r as unknown as { is_locked?: boolean }).is_locked && <Lock className="h-3 w-3 text-[color:var(--gold)]" />}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-white/60">
              <span className="rounded-sm bg-white/10 px-1 font-mono">{roomCode}</span>
              <span>· {members.length} online</span>
            </div>
          </div>
          {!isHost && (
            <button
              onClick={() => void followHost()}
              disabled={!!followsHost.data}
              className="ml-1 flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--primary)] px-2.5 py-1 text-[10px] font-extrabold disabled:from-white/10 disabled:to-white/10 disabled:text-white/50"
            >
              <UserPlus className="h-3 w-3" />
              {followsHost.data ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <IconRound onClick={share} label="Share">
            <Share2 className="h-3.5 w-3.5" />
          </IconRound>
          <IconRound onClick={() => toast.info("Reported")} label="Report">
            <Flag className="h-3.5 w-3.5" />
          </IconRound>
          <IconRound onClick={leaveRoom} label="Exit" danger>
            <Power className="h-3.5 w-3.5" />
          </IconRound>
        </div>
      </div>

      {/* Ranking / points / like row */}
      <div className="relative z-10 mx-auto mt-2 flex w-full max-w-md items-center gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-hide">
        <Pill icon={<Trophy className="h-3 w-3 text-[color:var(--gold)]" />}>
          No ranking <ChevronRight className="h-3 w-3 text-white/40" />
        </Pill>
        <Pill icon={<Flame className="h-3 w-3 text-[color:var(--gold)]" />}>
          <span className="font-extrabold text-[color:var(--gold)]">{roomPoints}</span>
        </Pill>
        <Pill icon={<Users className="h-3 w-3" />}>
          <span className="font-extrabold">{members.length}</span>
        </Pill>
        <button
          onClick={() => setLiked((v) => !v)}
          aria-label="Like"
          className="ml-auto grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/30 backdrop-blur"
        >
          <Heart
            className={`h-3.5 w-3.5 ${liked ? "fill-[color:var(--destructive)] text-[color:var(--destructive)]" : "text-white/70"}`}
          />
        </button>
      </div>

      {/* ─── Unified mic seats grid (host = seat 1) ──────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-md shrink-0 px-4 pt-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Mic Seats
          </span>
          <span className="text-[10px] font-bold text-white/70">
            {seatedCount}/{r.seat_count}
          </span>
        </div>
        {(() => {
          const sc = r.seat_count;
          const cols = sc <= 4 ? 4 : sc <= 6 ? 3 : sc <= 9 ? 3 : sc <= 12 ? 4 : sc <= 16 ? 4 : 5;
          const gap = sc <= 6 ? "gap-y-6 gap-x-4" : sc <= 9 ? "gap-y-5 gap-x-3" : "gap-y-4 gap-x-2.5";
          const colsClass =
            cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-4" : "grid-cols-5";
          return (
            <div className={`grid ${colsClass} ${gap}`}>
              {Array.from({ length: sc }).map((_, i) => {
                const m = seatsByIndex.get(i);
                const remote = m ? agora.remotes.get(uidFromUuid(m.user_id)) : undefined;
                const isHostSeat = i === 0;
                const fallbackHost =
                  isHostSeat && !m
                    ? { username: r.host?.username ?? null, avatar: r.host?.avatar ?? null }
                    : null;
                return (
                  <Seat
                    key={i}
                    index={i}
                    member={m}
                    remote={remote}
                    isHostSeat={isHostSeat}
                    cover={r.cover_url}
                    fallbackUser={fallbackHost}
                    onClaim={() => takeSeat(i)}
                  />
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ─── Chat overlay (transparent, scrolls internally) ──────── */}
      <div className="relative z-10 mx-auto mt-3 flex w-full max-w-md min-h-0 flex-1 flex-col px-3">
        <div className="flex-1 space-y-1.5 overflow-y-auto pb-2 pr-1 scrollbar-hide [mask-image:linear-gradient(to_bottom,transparent,black_24px,black)]">
          {messages.length === 0 && (
            <div className="mt-6 text-center text-[11px] text-white/40">
              Welcome to the room ✨ Say hi
            </div>
          )}
          {messages.map((m) => {
            const isGift = m.kind === "gift";
            if (isGift) {
              return (
                <div
                  key={m.id}
                  className="inline-flex max-w-[85%] items-center gap-2 rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-r from-[color:var(--gold)]/20 to-[color:var(--destructive)]/10 px-3 py-1.5 text-[12px] font-bold text-[color:var(--gold)]"
                >
                  🎁 <span className="text-white/80">@{m.user?.username ?? "user"}</span> sent{" "}
                  {m.text}
                </div>
              );
            }
            return (
              <div
                key={m.id}
                className="inline-flex max-w-[85%] items-start gap-2 rounded-2xl bg-black/40 px-2.5 py-1.5 backdrop-blur-sm"
              >
                <span className="text-[11px] font-bold text-[color:var(--gold)]">
                  @{m.user?.username ?? "user"}
                </span>
                <span className="break-words text-[12px] text-white/90">{m.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Message input (full-width pill) ─────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
          <button
            aria-label="Emoji"
            onClick={() => toast.info("Emoji soon")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/70"
          >
            <Smile className="h-4 w-4" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/40 outline-none"
            disabled={!user}
          />
          <button
            onClick={send}
            aria-label="Send"
            disabled={!text.trim()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Footer dock ─────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md">
          {/* Mic toggle */}
          <FooterBtn
            label="Mic"
            onClick={() => {
              if (!shouldPublish) {
                toast.info("Take a seat to talk");
                return;
              }
              agora.toggleMute();
            }}
            icon={
              agora.muted || !shouldPublish ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )
            }
            tint={
              !shouldPublish
                ? "muted"
                : agora.muted
                  ? "danger"
                  : "danger"
            }
          />
          <FooterBtn
            label="Emoji"
            onClick={() => toast.info("Emoji soon")}
            icon={<Smile className="h-4 w-4" />}
          />
          <FooterBtn
            label="Game"
            onClick={openLudo}
            icon={<Gamepad2 className="h-4 w-4" />}
          />
          {isHost && (
            <FooterBtn
              label="Music"
              onClick={() => setMusicOpen(true)}
              icon={<Music className="h-4 w-4" />}
            />
          )}
          {r.room_type === "video" && shouldPublish && (
            <FooterBtn
              label="Cam"
              onClick={agora.toggleVideo}
              icon={
                agora.videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />
              }
            />
          )}
          <FooterBtn
            label="Members"
            onClick={() => toast.info("Members panel soon")}
            icon={<Users className="h-4 w-4" />}
            badge={members.length}
          />
          <FooterBtn
            label={iAmOnSeat && !isHost ? "Off" : "Seats"}
            onClick={() => {
              if (isHost) setSeatsSheetOpen(true);
              else if (iAmOnSeat) leaveSeat();
              else toast.info("Tap a seat to join");
            }}
            icon={<Settings className="h-4 w-4" />}
          />
          <button
            onClick={() => {
              if (!user) {
                toast.error("Sign in to send gifts");
                return;
              }
              setGiftOpen(true);
            }}
            className="ml-auto flex flex-col items-center"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--destructive)] to-[color:var(--primary)] px-4 py-2 text-[12px] font-extrabold text-white shadow-lg shadow-[color:var(--destructive)]/30">
              <Gift className="h-4 w-4" /> Gift
            </span>
          </button>
        </div>
      </div>



      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        roomId={roomId}
        receivers={giftReceivers}
      />
      <LudoSheet
        open={ludoOpen}
        onClose={() => setLudoOpen(false)}
        players={ludoPlayers}
        isHost={isHost}
      />
      <HostMusicPlayer open={musicOpen && isHost} onClose={() => setMusicOpen(false)} />
      {isHost && (
        <SeatsSheet
          open={seatsSheetOpen}
          onClose={() => setSeatsSheetOpen(false)}
          value={r.seat_count}
          onChange={async (next) => {
            const delta = next - r.seat_count;
            if (delta !== 0) {
              // shrink: clear members on removed seats
              if (next < r.seat_count) {
                await supabase
                  .from("room_members")
                  .update({ seat_index: null })
                  .eq("room_id", roomId)
                  .gte("seat_index", next);
              }
              const { error } = await supabase
                .from("live_rooms")
                .update({ seat_count: next })
                .eq("id", roomId);
              if (error) {
                toast.error(error.message);
                return;
              }
              room.refetch();
            }
            setSeatsSheetOpen(false);
          }}
        />
      )}

    </div>
  );
}

function IconRound({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-full border border-white/10 backdrop-blur-md ${
        danger ? "bg-[color:var(--destructive)]/90 text-white" : "bg-black/30 text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">
      {icon}
      {children}
    </span>
  );
}

function RoundBtn({
  icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex flex-col items-center gap-0.5"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full border border-white/10 backdrop-blur-md ${
          active
            ? "bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
            : "bg-black/30 text-white/80"
        }`}
      >
        {icon}
      </span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--destructive)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      <span className="text-[9px] text-white/60">{label}</span>
    </button>
  );
}


function TopBtn({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5"
      aria-label={label}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full border border-border/60 ${danger ? "bg-[color:var(--destructive)]/90" : "bg-card/60"}`}
      >
        {icon}
      </span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </button>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  active,
  danger,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-0.5"
      aria-label={label}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full ${
          active
            ? "bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
            : danger
              ? "bg-[color:var(--destructive)]/80"
              : "bg-card/60 border border-border/60"
        }`}
      >
        {icon}
      </span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--destructive)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </button>
  );
}

function FooterBtn({
  icon,
  label,
  onClick,
  badge,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  tint?: "danger" | "muted";
}) {
  const bubble =
    tint === "danger"
      ? "bg-gradient-to-br from-[color:var(--destructive)] to-[color:var(--primary)] text-white shadow-md shadow-[color:var(--destructive)]/30"
      : tint === "muted"
        ? "bg-white/10 text-white/40 border border-white/10"
        : "bg-white/10 text-white/90 border border-white/10";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex flex-1 flex-col items-center gap-0.5"
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full ${bubble}`}>{icon}</span>
      {badge != null && badge > 0 && (
        <span className="absolute right-1 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--destructive)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      <span className="text-[9px] text-white/60">{label}</span>
    </button>
  );
}

function Seat({
  index,
  member,
  remote,
  isHostSeat,
  cover,
  fallbackUser,
  onClaim,
}: {
  index: number;
  member?: Member;
  remote?: RemoteUser;
  isHostSeat: boolean;
  cover: string | null;
  fallbackUser?: { username: string | null; avatar: string | null } | null;
  onClaim: () => void;
}) {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (remote?.videoTrack && videoRef.current) {
      remote.videoTrack.play(videoRef.current, { fit: "cover" });
    }
    return () => {
      remote?.videoTrack?.stop();
    };
  }, [remote?.videoTrack]);

  const label = String(index + 1).padStart(2, "0");
  const speaking = remote?.hasAudio && !member?.is_muted;

  const frameUrl = (member?.user as { frame_url?: string | null } | null)?.frame_url ?? null;
  const displayAvatar = member?.user?.avatar ?? fallbackUser?.avatar ?? null;
  const displayName = member?.user?.username ?? fallbackUser?.username ?? null;

  const ringClass = isHostSeat
    ? "ring-2 ring-[color:var(--gold)] shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
    : speaking
      ? "ring-2 ring-[color:var(--primary)]"
      : "ring-1 ring-white/10";

  return (
    <button
      onClick={() => (member ? undefined : onClaim())}
      className="relative flex flex-col items-center gap-1.5"
      aria-label={member ? `Seat ${label}` : `Take seat ${label}`}
    >
      <div className="relative aspect-square w-full">
        {/* Host gold aura */}
        {isHostSeat && (
          <div className="pointer-events-none absolute inset-[4%] rounded-full bg-gradient-to-tr from-[color:var(--gold)] via-amber-200 to-[color:var(--gold)] opacity-40 blur-md" />
        )}

        {/* Round DP */}
        <div
          className={`absolute inset-[10%] overflow-hidden rounded-full bg-card/40 ${ringClass}`}
        >
          {isHostSeat && !displayAvatar && cover && (
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          {displayAvatar && !remote?.videoTrack && (
            <img
              src={displayAvatar}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {remote?.videoTrack && <div ref={videoRef} className="absolute inset-0" />}
          {!displayAvatar && !isHostSeat && (
            <div className="absolute inset-0 grid place-items-center">
              <UserIcon className="h-1/3 w-1/3 text-muted-foreground/40" />
            </div>
          )}
          {!displayAvatar && isHostSeat && !cover && (
            <div className="absolute inset-0 grid place-items-center">
              <UserIcon className="h-1/3 w-1/3 text-[color:var(--gold)]/60" />
            </div>
          )}
        </div>


        {/* Frame overlay — sits on top of the round DP, doesn't clip it */}
        {frameUrl && (
          <img
            src={frameUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}

        {/* Seat number (hidden for host — crown badge instead) */}
        {!isHostSeat && (
          <span className="absolute left-0 top-0 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold">
            {label}
          </span>
        )}

        {/* Host crown */}
        {isHostSeat && (
          <>
            <Crown className="absolute -top-1 left-1/2 h-4 w-4 -translate-x-1/2 fill-[color:var(--gold)] text-[color:var(--gold)] drop-shadow" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-[color:var(--gold)] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-black shadow-lg">
              Host
            </span>
          </>
        )}

        {/* Mic status */}
        {(member || isHostSeat) && (
          <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-black/70">
            {member?.is_muted ? (
              <MicOff className="h-2.5 w-2.5 text-[color:var(--destructive)]" />
            ) : (
              <Mic className="h-2.5 w-2.5 text-[color:var(--primary)]" />
            )}
          </span>
        )}
      </div>

      {/* Username under the DP */}
      <span
        className={`max-w-full truncate text-[10px] font-bold ${isHostSeat ? "text-[color:var(--gold)]" : "text-foreground/90"}`}
      >
        {displayName ? `@${displayName}` : isHostSeat ? "Host" : "Seat"}
      </span>
    </button>
  );
}


function SeatsSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: number;
  onChange: (next: number) => void;
}) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (open) setN(value);
  }, [open, value]);
  if (!open) return null;
  const presets = [4, 6, 8, 12, 16, 20];
  const clamp = (x: number) => Math.max(4, Math.min(20, x));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-[color:var(--destructive)]" />
          <h2 className="text-lg font-extrabold">Room Seats</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose how many seats your room has (minimum 4, maximum 20).
        </p>

        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            onClick={() => setN((v) => clamp(v - 1))}
            disabled={n <= 4}
            aria-label="Fewer seats"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background/60 disabled:opacity-30"
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--destructive)] text-3xl font-extrabold text-primary-foreground shadow-lg">
            {n}
          </div>
          <button
            onClick={() => setN((v) => clamp(v + 1))}
            disabled={n >= 20}
            aria-label="More seats"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background/60 disabled:opacity-30"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {presets.map((p) => {
            const active = n === p;
            return (
              <button
                key={p}
                onClick={() => setN(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--primary)] text-primary-foreground"
                    : "border border-border bg-background/60 text-foreground/80"
                }`}
              >
                {p} seats
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onChange(n)}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--destructive)] py-3.5 text-base font-extrabold text-primary-foreground"
        >
          Done
        </button>
      </div>
    </>
  );
}

