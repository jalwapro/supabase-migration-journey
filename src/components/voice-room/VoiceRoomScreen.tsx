import { useEffect, useMemo, useState } from "react";
import { Rocket, Gift, Gamepad2, Smile, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { SafeGiftAnimationPlayer } from "@/components/room/SafeGiftAnimationPlayer";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const normalizeCapacity = (v: unknown) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(v)) || MAX_CAPACITY));

type RoomChatMessage = {
  id: string;
  user_id: string | null;
  text: string | null;
  message?: string | null;
  kind: string;
  created_at: string;
  sender_username?: string | null;
  pending?: boolean;
  failed?: boolean;
};

interface VoiceRoomScreenProps {
  room: RoomState;
  roomId: string;
  seatCount?: number;
  roomCode: string;
  onlineCount: number;
  micOn: boolean;
  isHost: boolean;
  mySeatIndex: number | null;
  popularityPct: number;
  topGifterName?: string | null;
  topGifterCoins?: number;
  announcement?: string | null;
  messages?: RoomChatMessage[];
  onOpenChat: () => void;
  onOpenPrivateChat: () => void;
  onOpenGift: () => void;
  onOpenMore: () => void;
  onToggleMic: () => void;
  speakerMuted: boolean;
  onToggleSpeaker: () => void;
  onOpenMusic?: () => void;
  onSendEmoji?: (emoji: unknown) => void;
  canPlayMusic?: boolean;
  onSeatTap: (i: number) => void;
  onJoinSeat: (i: number) => void;
  onHostTap?: () => void;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onHome: () => void;
  onRanking: () => void;
  onOpenGames: () => void;
}

export const VoiceRoomScreen = ({
  room, roomId, seatCount, roomCode, onlineCount, micOn, speakerMuted, isHost,
  popularityPct, topGifterName, topGifterCoins, announcement, messages = [],
  onOpenChat, onOpenGift, onToggleMic, onToggleSpeaker, onSeatTap, onJoinSeat,
  onHostTap, onReport, onShare, onExit, onHome, onRanking, onOpenGames,
}: VoiceRoomScreenProps) => {
  const [liveSeatCount, setLiveSeatCount] = useState(() => normalizeCapacity(seatCount));
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>(messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const effectiveSeatCount = normalizeCapacity(seatCount ?? liveSeatCount);

  useEffect(() => {
    if (seatCount != null) setLiveSeatCount(normalizeCapacity(seatCount));
  }, [seatCount]);

  useEffect(() => {
    if (messages.length) setRoomMessages(messages.slice(-50));
  }, [messages]);

  useEffect(() => {
    let active = true;
    void supabase
      .from("room_messages")
      .select("id,user_id,kind,text,message,created_at,sender_username")
      .eq("room_id", roomId)
      .neq("kind", "emoji")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setRoomMessages(data as RoomChatMessage[]);
      });
    return () => { active = false; };
  }, [roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`voice-chat-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, payload => {
        const row = payload.new as RoomChatMessage;
        if (row.kind === "emoji") return;
        setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row].slice(-50));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const sendRoomMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setDraft(text);
      setSending(false);
      return;
    }
    const { data, error } = await supabase
      .from("room_messages")
      .insert({ room_id: roomId, user_id: auth.user.id, kind: "text", text, client_id: crypto.randomUUID() })
      .select("id,user_id,kind,text,message,created_at,sender_username")
      .single();
    if (error) setDraft(text);
    else if (data) setRoomMessages(prev => [...prev, data as RoomChatMessage].slice(-50));
    setSending(false);
  };

  const visibleMessages = useMemo(() => roomMessages.filter(m => m.kind !== "emoji").slice(-8), [roomMessages]);
  const buttonClass = "touch-manipulation select-none active:scale-95 transition-transform";
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  return (
    <main className="relative z-50 mx-auto flex h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden bg-background text-foreground shadow-2xl">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <RoomHeader
          room={room}
          roomCode={roomCode}
          onlineCount={onlineCount}
          topGifterName={topGifterName}
          topGifterCoins={topGifterCoins}
          onHostTap={onHostTap}
          onReport={onReport}
          onShare={onShare}
          onExit={onExit}
          onHome={onHome}
          onRanking={onRanking}
        />
        <SafeGiftAnimationPlayer roomId={roomId} />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <SeatGrid
            seats={room.seats}
            seatCount={effectiveSeatCount}
            host={room.host}
            roomId={roomId}
            isHost={isHost}
            onSeatTap={onSeatTap}
            onJoinSeat={onJoinSeat}
            onHostTap={onHostTap}
          />
        </div>

        <section className="grid h-[clamp(160px,27dvh,220px)] shrink-0 grid-cols-[minmax(0,1.7fr)_minmax(80px,.7fr)] gap-1.5 px-2 py-1.5">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border/50 bg-background/75 backdrop-blur-md">
            <div className="flex h-8 shrink-0 items-center gap-5 border-b border-border/40 px-2.5">
              <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "text-xs font-semibold")}>All</button>
              <span className="text-xs text-muted-foreground">Chat</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5">
              {visibleMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                  <div><Smile className="mx-auto mb-1 h-5 w-5" /><p className="text-[11px]">{announcement || "No messages yet"}</p></div>
                </div>
              ) : visibleMessages.map(message => (
                <div key={message.id} className="mb-1 break-words text-xs">
                  <span className="font-semibold text-primary">{message.sender_username || "User"}: </span>
                  <span>{message.text || message.message || ""}</span>
                </div>
              ))}
            </div>
            <form onSubmit={event => { event.preventDefault(); void sendRoomMessage(); }} className="mx-1.5 mb-1.5 flex h-10 shrink-0 items-center gap-2 rounded-full border bg-background px-2.5">
              <input value={draft} onChange={event => setDraft(event.target.value.slice(0, 500))} placeholder="Say something..." disabled={sending} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
              <button type="button" onClick={tap(onOpenChat)} aria-label="Emoji" className="grid h-7 w-7 place-items-center"><Smile className="h-4 w-4" /></button>
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
            </form>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-1.5">
            <button type="button" onClick={tap(onRanking)} className={cn(buttonClass, "grid min-h-0 flex-1 place-items-center rounded-xl border p-1.5")}><span className="flex flex-col items-center"><Rocket className="h-7 w-7 text-secondary" /><span className="mt-0.5 text-[9px] font-bold">{popularityPct}% Popular</span></span></button>
            <button type="button" onClick={tap(onOpenGames)} className={cn(buttonClass, "h-10 rounded-xl border text-[10px] font-bold")}><Gamepad2 className="mr-1 inline h-4 w-4" />Games</button>
          </div>
        </section>
      </div>

      <nav className="relative z-20 flex h-[clamp(52px,7dvh,62px)] shrink-0 items-center justify-around border-t bg-primary px-1 pb-[env(safe-area-inset-bottom)] text-primary-foreground">
        <button type="button" onClick={tap(onToggleMic)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-white/10")} aria-label={micOn ? "Mute microphone" : "Unmute microphone"}>{micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</button>
        <button type="button" onClick={tap(onToggleSpeaker)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-white/10")} aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}>{speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <button type="button" onClick={tap(onOpenGift)} className={cn(buttonClass, "grid h-10 w-10 place-items-center rounded-full border border-white/50 bg-white/10")} aria-label="Open gifts"><Gift className="h-5 w-5" /></button>
      </nav>
    </main>
  );
};
