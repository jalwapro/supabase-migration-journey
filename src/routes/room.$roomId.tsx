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

  async function takeSeat(seatIndex: number) {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (seatIndex === 0 && !isHost) {
      toast.error("Seat 1 is for the host");
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

  const ludoPlayers: LudoPlayer[] = [0, 1, 2, 3].map((i) => {
    const m = seatsByIndex.get(i);
    return m
      ? { id: m.user_id, username: m.user?.username ?? null, avatar: m.user?.avatar ?? null }
      : { id: `empty-${i}`, username: null, avatar: null };
  });

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
      className="min-h-[100dvh] pb-28"
      style={{
        background:
          "radial-gradient(1200px 500px at 50% -10%, color-mix(in oklab, var(--primary) 40%, transparent), #0e0a1a 60%)",
      }}
    >
      {/* Top row */}
      <div
        className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        {/* Host card */}
        <div className="glass flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1.5 pl-1.5 pr-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--primary)]">
            {r.host?.avatar ? (
              <img src={r.host.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-4 w-4 text-primary-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold leading-tight">
              {r.host?.username ? `${r.host.username}'s Live` : r.title}
            </div>
            <div className="text-[10px] text-muted-foreground">ID: {roomCode}</div>
          </div>
          <button
            onClick={() => setLiked((v) => !v)}
            aria-label="Like"
            className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-background/40"
          >
            <Heart
              className={`h-3.5 w-3.5 ${liked ? "fill-[color:var(--destructive)] text-[color:var(--destructive)]" : "text-muted-foreground"}`}
            />
          </button>
        </div>

        {/* Actions column */}
        <div className="flex items-center gap-2">
          <TopBtn
            icon={<Flag className="h-3.5 w-3.5" />}
            label="Report"
            onClick={() => toast.info("Reported")}
          />
          <TopBtn
            icon={<Share2 className="h-3.5 w-3.5" />}
            label="Share"
            onClick={share}
          />
          <TopBtn
            icon={<Power className="h-3.5 w-3.5" />}
            label={isHost ? "End" : "Exit"}
            onClick={leaveRoom}
            danger
          />
        </div>
      </div>

      {/* Rank + viewers row */}
      <div className="mx-auto flex max-w-md items-center justify-between px-3 pb-3">
        <button className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] font-semibold">
          <Trophy className="h-3 w-3 text-[color:var(--gold)]" />
          No ranking yet
          <span className="text-muted-foreground">›</span>
        </button>
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] font-bold">
          <Users className="h-3 w-3" /> {members.length}
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
        </div>
      </div>

      <main className="mx-auto max-w-md px-3">
        {/* Seat grid */}
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: r.seat_count }).map((_, i) => {
            const m = seatsByIndex.get(i);
            const remote = m ? agora.remotes.get(uidFromUuid(m.user_id)) : undefined;
            const isHostSeat = i === 0;
            return (
              <Seat
                key={i}
                index={i}
                member={m}
                remote={remote}
                isHostSeat={isHostSeat}
                cover={r.cover_url}
                onClaim={() => takeSeat(i)}
              />
            );
          })}
        </div>

        {/* Welcome banner */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-3 py-2.5">
          <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
          <div className="min-w-0 flex-1 truncate text-[12px]">
            <span className="font-bold">
              {r.host?.username ? `${r.host.username}'s Live` : r.title}
            </span>
            <span className="text-muted-foreground"> — welcome to the room ✨</span>
          </div>
          <span className="text-muted-foreground">›</span>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex items-center gap-4 border-b border-border/40 px-1">
          {(["all", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChatTab(t)}
              className={`relative pb-2 text-sm font-bold capitalize ${
                chatTab === t ? "" : "text-muted-foreground"
              }`}
            >
              {t}
              {chatTab === t && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--primary)]" />
              )}
            </button>
          ))}
        </div>

        {/* Chat + side cards */}
        <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <div className="min-h-[180px] space-y-2">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-xs text-muted-foreground">Say hello 👋</p>
            )}
            {messages.map((m) => {
              const isGift = m.kind === "gift";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${isGift ? "rounded-xl bg-gradient-to-r from-[color:var(--gold)]/15 to-[color:var(--primary)]/10 p-2" : ""}`}
                >
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--secondary)]/40 text-[10px] font-bold">
                    {(m.user?.username ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">@{m.user?.username ?? "user"}</p>
                    {isGift ? (
                      <p className="break-words text-sm font-bold text-[color:var(--gold)]">
                        🎁 sent {m.text}
                      </p>
                    ) : (
                      <p className="break-words text-sm">{m.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <Flame className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Room Points
              </div>
              <div className="mt-1 text-lg font-extrabold text-[color:var(--gold)]">{roomPoints}</div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-background/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)]"
                  style={{ width: `${Math.min(100, roomPoints / 5)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-bold">
                  <Users className="h-3.5 w-3.5 text-[color:var(--destructive)]" /> Members
                </span>
                <span className="text-[color:var(--gold)] font-bold">{members.length}</span>
              </div>
              <div className="mt-2 flex -space-x-2">
                {members.slice(0, 5).map((m) => (
                  <div
                    key={m.user_id}
                    className="h-6 w-6 overflow-hidden rounded-full border-2 border-card bg-[color:var(--secondary)]/40 grid place-items-center text-[9px] font-bold"
                  >
                    {m.user?.avatar ? (
                      <img src={m.user.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.user?.username ?? "?").slice(0, 1).toUpperCase()
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">Tap to manage members</p>
            </div>
          </div>
        </div>
      </main>

      {/* Message input + bottom action bar */}
      <div
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border/40 bg-background/80 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5">
            <Smile className="h-4 w-4 text-muted-foreground" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-sm outline-none"
              disabled={!user}
            />
          </div>
          <button
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send"
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 flex items-end justify-between gap-1 px-2 pb-1">
          <ActionBtn
            icon={
              agora.muted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )
            }
            label="Mic"
            active={!agora.muted && shouldPublish}
            onClick={() => {
              if (!shouldPublish) {
                toast.info("Take a seat to talk");
                return;
              }
              agora.toggleMute();
            }}
            danger
          />
          <ActionBtn
            icon={<Smile className="h-4 w-4" />}
            label="Emoji"
            onClick={() => toast.info("Emoji coming soon")}
          />
          <ActionBtn
            icon={<Gamepad2 className="h-4 w-4" />}
            label="Game"
            onClick={() => setLudoOpen(true)}
          />
          {isHost && (
            <ActionBtn
              icon={<Music className="h-4 w-4" />}
              label="Music"
              onClick={() => setMusicOpen(true)}
            />
          )}
          {r.room_type === "video" && shouldPublish && (
            <ActionBtn
              icon={
                agora.videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />
              }
              label="Cam"
              active={agora.videoOn}
              onClick={agora.toggleVideo}
            />
          )}
          <ActionBtn
            icon={<Users className="h-4 w-4" />}
            label="Members"
            badge={members.length}
            onClick={() => toast.info("Members panel soon")}
          />
          <ActionBtn
            icon={<Settings className="h-4 w-4" />}
            label={iAmOnSeat && !isHost ? "Step off" : "Seats"}
            onClick={() => {
              if (iAmOnSeat && !isHost) leaveSeat();
              else toast.info("Tap a seat to join");
            }}
          />
          <button
            onClick={() => {
              if (!user) {
                toast.error("Sign in to send gifts");
                return;
              }
              setGiftOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-3 py-2 text-xs font-extrabold text-primary-foreground"
          >
            <Gift className="h-4 w-4" /> Gift
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
    </div>
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

function Seat({
  index,
  member,
  remote,
  isHostSeat,
  cover,
  onClaim,
}: {
  index: number;
  member?: Member;
  remote?: RemoteUser;
  isHostSeat: boolean;
  cover: string | null;
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

  return (
    <button
      onClick={() => (member ? undefined : onClaim())}
      className="relative flex flex-col items-center"
      aria-label={member ? `Seat ${label}` : `Take seat ${label}`}
    >
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-border/40 bg-card/40 ${
          speaking ? "ring-2 ring-[color:var(--primary)]" : ""
        }`}
      >
        {/* Cover (host seat only when empty) */}
        {isHostSeat && !member && cover && (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        {/* Occupied — show avatar or video */}
        {member?.user?.avatar && !remote?.videoTrack && (
          <img
            src={member.user.avatar}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {remote?.videoTrack && <div ref={videoRef} className="absolute inset-0" />}
        {isHostSeat && member && cover && !member.user?.avatar && (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!member && !isHostSeat && (
          <div className="absolute inset-0 grid place-items-center">
            <UserIcon className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}

        {/* Seat number */}
        <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold">
          {label}
        </span>

        {/* Mic + Seat label bottom */}
        <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[9px] font-bold text-[color:var(--primary)]">
          {member?.is_muted ? (
            <MicOff className="h-2.5 w-2.5" />
          ) : (
            <Mic className="h-2.5 w-2.5" />
          )}
          <span>{member?.user?.username ? `@${member.user.username.slice(0, 6)}` : "Seat"}</span>
        </div>
      </div>
    </button>
  );
}
