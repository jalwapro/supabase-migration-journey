import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useAgoraRoom, type RemoteUser } from "@/hooks/useAgoraRoom";
import {
  ArrowLeft, Users, Radio, Mic, MicOff, Video, VideoOff, LogOut, Gift, Send, Plus, User as UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";

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
  return Math.abs(h) % 2_000_000_000 + 1;
}

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("id,title,cover_url,room_type,status,viewer_count,seat_count,host_id,agora_channel,host:profiles!live_rooms_host_id_fkey(username,avatar)")
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
          .select("room_id,user_id,seat_index,is_muted,is_video,user:profiles!room_members_user_id_fkey(username,avatar)")
          .eq("room_id", roomId),
        supabase
          .from("room_messages")
          .select("id,user_id,kind,text,created_at,user:profiles!room_messages_user_id_fkey(username,avatar)")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancel) return;
      setMembers(((mData ?? []) as unknown as Member[]));
      setMessages(((msgData ?? []) as unknown as Message[]).reverse());
    })();
    return () => { cancel = true; };
  }, [roomId]);

  // Realtime: chat + members
  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const row = payload.new as Message;
        if (row.user_id) {
          const { data } = await supabase.from("profiles").select("username,avatar").eq("id", row.user_id).maybeSingle();
          row.user = (data as Message["user"]) ?? null;
        }
        setMessages((prev) => [...prev.slice(-99), row]);
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}`,
      }, async () => {
        const { data } = await supabase
          .from("room_members")
          .select("room_id,user_id,seat_index,is_muted,is_video,user:profiles!room_members_user_id_fkey(username,avatar)")
          .eq("room_id", roomId);
        setMembers(((data ?? []) as unknown as Member[]));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [roomId]);

  // Join as viewer (or seat 0 if host) on mount
  useEffect(() => {
    if (!user || !room.data) return;
    const seatIndex = isHost ? 0 : null;
    void supabase
      .from("room_members")
      .upsert({ room_id: roomId, user_id: user.id, seat_index: seatIndex }, { onConflict: "room_id,user_id" });
    return () => {
      void supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    };
  }, [user, room.data, roomId, isHost]);

  async function takeSeat(seatIndex: number) {
    if (!user) { toast.error("Sign in first"); return; }
    if (seatIndex === 0 && !isHost) { toast.error("Seat 0 is for the host"); return; }
    const { error } = await supabase
      .from("room_members")
      .upsert({ room_id: roomId, user_id: user.id, seat_index: seatIndex }, { onConflict: "room_id,user_id" });
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
    if (!user) { toast.error("Sign in to chat"); return; }
    const v = text.trim();
    if (!v) return;
    setText("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId, user_id: user.id, kind: "chat", text: v,
    });
    if (error) { toast.error(error.message); setText(v); }
  }

  async function leaveRoom() {
    if (user && isHost) {
      await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
    }
    navigate({ to: "/" });
  }

  if (room.isLoading) {
    return (
      <>
        <AppShell title="Loading…"><div className="p-6 text-sm text-muted-foreground">Loading room…</div></AppShell>
        <BottomNav />
      </>
    );
  }
  if (!room.data) {
    return (
      <>
        <AppShell title="Not found">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">This room doesn't exist.</p>
            <Link to="/" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Home</Link>
          </div>
        </AppShell>
        <BottomNav />
      </>
    );
  }

  const r = room.data;
  const seatsByIndex = new Map<number, Member>();
  members.forEach((m) => { if (m.seat_index != null) seatsByIndex.set(m.seat_index, m); });
  const giftReceivers: GiftReceiver[] = [
    ...(r.host && r.host_id !== user?.id
      ? [{ id: r.host_id, username: r.host.username, avatar: r.host.avatar }]
      : []),
    ...members
      .filter((m) => m.seat_index != null && m.user_id !== user?.id && m.user_id !== r.host_id)
      .map((m) => ({ id: m.user_id, username: m.user?.username ?? null, avatar: m.user?.avatar ?? null })),
  ];

  return (
    <div
      className="min-h-[100dvh] pb-24"
      style={{ background: "radial-gradient(1200px 500px at 50% -10%, color-mix(in oklab, var(--primary) 40%, transparent), transparent)" }}
    >
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
          <button onClick={() => navigate({ to: "/" })} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-card/60">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">{r.title}</h1>
            <p className="truncate text-[10px] text-muted-foreground">
              @{r.host?.username ?? "host"} • {members.length} in room
              {agora.status === "connecting" && " • connecting…"}
              {agora.status === "disabled" && " • Agora not configured"}
              {agora.status === "error" && " • connection error"}
            </p>
          </div>
          <button onClick={leaveRoom} className="flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-3 py-1.5 text-xs font-bold">
            <LogOut className="h-3 w-3" />
            {isHost ? "End" : "Leave"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        {/* Seats */}
        <div className="glass rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-2 py-0.5 text-[10px] font-bold uppercase">
                <Radio className="h-2.5 w-2.5" /> Live
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {r.room_type === "video" ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />} {r.room_type}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" /> {r.seat_count} seats
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: r.seat_count }).map((_, i) => {
              const m = seatsByIndex.get(i);
              const remote = m ? agora.remotes.get(uidFromUuid(m.user_id)) : undefined;
              return (
                <Seat
                  key={i}
                  index={i}
                  member={m}
                  remote={remote}
                  isMe={m?.user_id === user?.id}
                  isHostSeat={i === 0}
                  onClaim={() => takeSeat(i)}
                  showLocalVideo={agora.videoOn && m?.user_id === user?.id && r.room_type === "video"}
                />
              );
            })}
          </div>

          {/* Control bar */}
          {user && agora.status === "connected" && shouldPublish && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={agora.toggleMute}
                aria-label={agora.muted ? "Unmute" : "Mute"}
                className={`grid h-11 w-11 place-items-center rounded-full ${agora.muted ? "bg-[color:var(--destructive)]/80" : "bg-card/70 border border-border"}`}
              >
                {agora.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              {r.room_type === "video" && (
                <button
                  onClick={agora.toggleVideo}
                  aria-label={agora.videoOn ? "Turn camera off" : "Turn camera on"}
                  className={`grid h-11 w-11 place-items-center rounded-full ${agora.videoOn ? "bg-card/70 border border-border" : "bg-[color:var(--destructive)]/80"}`}
                >
                  {agora.videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
              )}
              {iAmOnSeat && !isHost && (
                <button
                  onClick={leaveSeat}
                  className="rounded-full border border-border bg-card/70 px-4 py-2 text-xs font-semibold"
                >
                  Step off
                </button>
              )}
            </div>
          )}
          {agora.status === "disabled" && isHost && (
            <div className="mt-3 rounded-xl bg-[color:var(--gold)]/10 p-2 text-center text-[11px] text-[color:var(--gold)]">
              Add Agora App ID + Certificate in Admin Panel to enable voice/video.
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="mt-4 glass rounded-3xl p-3">
          <div className="max-h-[38vh] min-h-[26vh] space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="pt-6 text-center text-xs text-muted-foreground">Say hi to the room 👋</p>
            )}
            {messages.map((m) => {
              const isGift = m.kind === "gift";
              return (
                <div key={m.id} className={`flex items-start gap-2 ${isGift ? "rounded-xl bg-gradient-to-r from-[color:var(--gold)]/15 to-[color:var(--primary)]/10 p-2" : ""}`}>
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

          <div className="mt-3 flex items-center gap-2">
            <button
              aria-label="Gift"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground"
              onClick={() => {
                if (!user) { toast.error("Sign in to send gifts"); return; }
                setGiftOpen(true);
              }}
            >
              <Gift className="h-4 w-4" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={user ? "Say something…" : "Sign in to chat"}
              disabled={!user}
              className="flex-1 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]"
            />
            <button
              onClick={send}
              disabled={!user || !text.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        roomId={roomId}
        receivers={giftReceivers}
      />
    </div>
  );
}

function Seat({
  index, member, remote, isMe, isHostSeat, onClaim, showLocalVideo,
}: {
  index: number;
  member?: Member;
  remote?: RemoteUser;
  isMe: boolean;
  isHostSeat: boolean;
  onClaim: () => void;
  showLocalVideo: boolean;
}) {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (remote?.videoTrack && videoRef.current) {
      remote.videoTrack.play(videoRef.current, { fit: "cover" });
    }
    return () => { remote?.videoTrack?.stop(); };
  }, [remote?.videoTrack]);

  const hasSeatUser = !!member;
  const speaking = remote?.hasAudio && !member?.is_muted;

  if (!hasSeatUser) {
    return (
      <button
        onClick={onClaim}
        className="flex flex-col items-center gap-1"
        aria-label={`Take seat ${index + 1}`}
      >
        <div className={`grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border transition-colors ${isHostSeat ? "border-[color:var(--gold)]/50" : "hover:border-[color:var(--primary)]"}`}>
          <Plus className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-[9px] text-muted-foreground">{isHostSeat ? "Host" : `Seat ${index + 1}`}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative grid h-14 w-14 overflow-hidden place-items-center rounded-full ${speaking ? "ring-2 ring-[color:var(--primary)] ring-offset-2 ring-offset-background" : ""} ${isHostSeat ? "border-2 border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "bg-card border border-border"}`}>
        {showLocalVideo ? (
          <div className="absolute inset-0" ref={(el) => {
            // local track render handled by hook — for MVP show avatar placeholder while camera runs
          }} />
        ) : remote?.videoTrack ? (
          <div ref={videoRef} className="absolute inset-0" />
        ) : member.user?.avatar ? (
          <img src={member.user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-5 w-5 text-muted-foreground" />
        )}
        {member.is_muted && (
          <div className="absolute right-0 bottom-0 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--destructive)]">
            <MicOff className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
      <span className="max-w-[56px] truncate text-[9px] text-muted-foreground">
        {isMe ? "You" : `@${member.user?.username ?? "user"}`}
      </span>
    </div>
  );
}
