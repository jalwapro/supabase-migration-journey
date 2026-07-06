import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Users, Radio, Mic, Video, LogOut, Gift, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

type Message = {
  id: string;
  user_id: string | null;
  kind: string;
  text: string | null;
  created_at: string;
  user: { username: string | null; avatar: string | null } | null;
};

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

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

  // Initial messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("room_messages")
        .select(
          "id,user_id,kind,text,created_at,user:profiles!room_messages_user_id_fkey(username,avatar)",
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setMessages(((data ?? []) as unknown as Message[]).reverse());
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Realtime chat
  useEffect(() => {
    const channel = supabase
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
          // fetch username for the new message
          if (row.user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("username,avatar")
              .eq("id", row.user_id)
              .maybeSingle();
            row.user = (data as Message["user"]) ?? null;
          }
          setMessages((prev) => [...prev.slice(-99), row]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function send() {
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    const value = text.trim();
    if (!value) return;
    setText("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      kind: "chat",
      text: value,
    });
    if (error) {
      toast.error(error.message);
      setText(value);
    }
  }

  async function leaveRoom() {
    if (user && room.data?.host_id === user.id) {
      // Host ends the room
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
  const TypeIcon = r.room_type === "video" ? Video : Mic;
  const isHost = user?.id === r.host_id;

  return (
    <div className="min-h-[100dvh] pb-24" style={{ background: "radial-gradient(1200px 500px at 50% -10%, color-mix(in oklab, var(--primary) 40%, transparent), transparent)" }}>
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">{r.title}</h1>
            <p className="truncate text-[10px] text-muted-foreground">
              @{r.host?.username ?? "host"} • {r.viewer_count} viewers
            </p>
          </div>
          <button
            onClick={leaveRoom}
            className="flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-3 py-1.5 text-xs font-bold"
          >
            <LogOut className="h-3 w-3" />
            {isHost ? "End" : "Leave"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        {/* Seats placeholder — Phase 3 wires Agora */}
        <div className="glass rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-2 py-0.5 text-[10px] font-bold uppercase">
                <Radio className="h-2.5 w-2.5" /> Live
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <TypeIcon className="h-3 w-3" /> {r.room_type}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" /> {r.seat_count} seats
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: r.seat_count }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border ${i === 0 ? "border-solid border-[color:var(--gold)] bg-[color:var(--gold)]/10" : ""}`}>
                  {i === 0 && r.host?.avatar ? (
                    <img src={r.host.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <span className="truncate text-[9px] text-muted-foreground">
                  {i === 0 ? "Host" : "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            Agora audio/video · connects in phase 3
          </p>
        </div>

        {/* Chat */}
        <div className="mt-4 glass rounded-3xl p-3">
          <div className="max-h-[45vh] min-h-[30vh] space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="pt-6 text-center text-xs text-muted-foreground">
                Say hi to the room 👋
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--secondary)]/40 text-[10px] font-bold">
                  {(m.user?.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">
                    @{m.user?.username ?? "user"}
                  </p>
                  <p className="break-words text-sm">{m.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              aria-label="Gift"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground"
              onClick={() => toast("Gifts coming in Phase 5 🎁")}
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
    </div>
  );
}
