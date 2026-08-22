import { useEffect, useMemo, useState } from "react";
import { Rocket, Calendar, Megaphone, Home, Gift, Gamepad2, MessageCircle, Mic, MicOff, Smile, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
import { RoomGamesSheet } from "@/components/room/RoomGamesSheet";

const OCTAGON = { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" } as const;
const CAPACITIES = new Set([4, 8, 12, 16, 20]);
const normalizeCapacity = (value: unknown) => {
  const n = Math.floor(Number(value));
  return CAPACITIES.has(n) ? n : 20;
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
  onOpenChat: () => void;
  onOpenPrivateChat: () => void;
  onOpenGift: () => void;
  onOpenMore: () => void;
  onToggleMic: () => void;
  onSeatTap: (index: number) => void;
  onJoinSeat: (index: number) => void;
  onHostTap?: () => void;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onHome: () => void;
  onRanking: () => void;
  onOpenGames: () => void;
}

export const VoiceRoomScreen = ({ room, roomId, seatCount, roomCode, onlineCount, micOn, isHost, mySeatIndex, popularityPct, topGifterName, topGifterCoins, announcement, onOpenChat, onOpenPrivateChat, onOpenGift, onOpenMore, onToggleMic, onSeatTap, onJoinSeat, onHostTap, onReport, onShare, onExit, onHome, onRanking, onOpenGames }: VoiceRoomScreenProps) => {
  const [giftOpen, setGiftOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [liveSeatCount, setLiveSeatCount] = useState(() => normalizeCapacity(seatCount));
  const effectiveSeatCount = normalizeCapacity(seatCount ?? liveSeatCount);
  const canSpeak = isHost || mySeatIndex !== null;

  // The route normally passes room.seat_count. This fallback keeps the reusable
  // room component authoritative even when embedded elsewhere, and the UPDATE
  // subscription makes host layout changes visible to every connected client.
  useEffect(() => {
    if (seatCount != null) {
      setLiveSeatCount(normalizeCapacity(seatCount));
      return;
    }
    let active = true;
    void supabase.from("live_rooms").select("seat_count").eq("id", roomId).maybeSingle().then(({ data, error }) => {
      if (!active || error || !data) return;
      setLiveSeatCount(normalizeCapacity((data as { seat_count?: number }).seat_count));
    });
    const channel = supabase.channel(`voice-layout-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (payload) => {
      const row = payload.new as { seat_count?: number };
      if (row.seat_count != null) setLiveSeatCount(normalizeCapacity(row.seat_count));
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, seatCount]);

  const tap = (handler: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); handler(); };
  const buttonClass = "touch-manipulation pointer-events-auto select-none";
  const receivers = useMemo<GiftReceiver[]>(() => {
    const seated = room.seats.filter(s => s.user && s.user.id !== room.host.id).map(s => ({ id: s.user!.id, username: s.user!.username, avatar: s.user!.avatar }));
    return room.host.id ? [{ id: room.host.id, username: room.host.username, avatar: room.host.avatar }, ...seated] : seated;
  }, [room]);

  const openGifts = () => { setGiftOpen(true); onOpenGift(); };
  const openGames = () => { setGamesOpen(true); onOpenGames(); };
  const openRoomChat = () => onOpenChat();
  const openSeat = () => {
    if (mySeatIndex !== null) { onSeatTap(mySeatIndex); return; }
    const nextSeat = room.seats.find((seat) => seat.index >= 1 && seat.index <= effectiveSeatCount && !seat.user && !seat.is_locked);
    if (!nextSeat) return;
    onJoinSeat(nextSeat.index);
  };

  return <main className="relative z-50 pointer-events-auto touch-manipulation overscroll-none mx-auto flex h-[100dvh] min-h-[100dvh] w-full max-w-none flex-col overflow-hidden overscroll-none bg-background text-foreground shadow-2xl">
    <div className="pointer-events-none absolute inset-0" />
    <RoomHeader room={room} roomCode={roomCode} onlineCount={onlineCount} topGifterName={topGifterName} topGifterCoins={topGifterCoins} onHostTap={onHostTap} onReport={onReport} onShare={onShare} onExit={onExit} onHome={onHome} onRanking={onRanking} />
    <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden pb-2">
      <SeatGrid seats={room.seats} seatCount={effectiveSeatCount} host={room.host} micOn={micOn} onToggleMic={onToggleMic} onSeatTap={onSeatTap} onJoinSeat={onJoinSeat} onHostTap={onHostTap} />
      <div className="mx-2.5 flex shrink-0 items-center gap-2 overflow-hidden rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--card)]/85 py-1.5 pl-1 pr-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[11px] text-primary-foreground">📣</span><p className="min-w-0 flex-1 truncate text-xs text-foreground/70">{announcement || `Welcome to ${room.title} — be kind, have fun ✨`}</p><Rocket className="h-4 w-4 shrink-0 text-[color:var(--secondary)]" /></div>
      <div className="flex min-h-[170px] shrink-0 gap-2 overflow-hidden px-2.5">
        <div className="flex min-h-0 flex-[1.9] flex-col overflow-hidden rounded-2xl border border-[color:var(--secondary)]/30 bg-[color:var(--card)]/70">
          <div className="flex items-center gap-4 border-b border-foreground/10 px-2.5 pt-2"><button type="button" onClick={tap(openRoomChat)} className={cn(buttonClass,"relative pb-1.5 text-[12px] font-bold text-foreground")}>All<span className="absolute -bottom-px left-0 h-0.5 w-full rounded-full bg-[color:var(--primary)]" /></button><button type="button" onClick={tap(openRoomChat)} className={cn(buttonClass,"pb-1.5 text-[12px] font-semibold text-foreground/60")}>Chat</button></div>
          <button type="button" onClick={tap(openRoomChat)} className={cn(buttonClass,"flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-center text-foreground/35")}><MessageCircle className="h-7 w-7" /><p className="text-xs font-medium">Open room chat</p><p className="text-[10px]">Start the conversation</p></button>
          <div className="flex items-center gap-2 border-t border-foreground/10 px-2 py-2"><button type="button" onClick={tap(openRoomChat)} className={cn(buttonClass,"flex min-w-0 flex-1 items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-left")}><span className="min-w-0 flex-1 truncate text-[12px] text-foreground/40">Say something...</span><Smile className="h-3.5 w-3.5 shrink-0 text-foreground/50" /></button><button type="button" onClick={tap(openRoomChat)} aria-label="Open room chat composer" className={cn(buttonClass,"grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--primary)] text-primary-foreground")}><Send className="h-3.5 w-3.5" /></button></div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"><button type="button" onClick={tap(onRanking)} className={cn(buttonClass,"shrink-0 rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--card)]/80 p-2.5 text-left")}><div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/90"><Rocket className="h-3.5 w-3.5 text-[color:var(--primary)]" />Popularity</div><div className="rounded-full border border-[color:var(--primary)]/30 bg-background/60 px-2 py-1 text-center text-[10px] font-black text-[color:var(--primary)]">{popularityPct}%</div></button><button type="button" onClick={tap(openGames)} className={cn(buttonClass,"shrink-0 rounded-2xl border border-[color:var(--secondary)]/25 bg-[color:var(--card)]/70 p-2.5 text-left")}><div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/85"><Calendar className="h-3.5 w-3.5 text-[color:var(--secondary)]" />Events</div><p className="text-[10px] text-foreground/45">Open Games</p></button><button type="button" onClick={tap(onOpenMore)} className={cn(buttonClass,"min-h-0 flex-1 overflow-hidden rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--card)]/70 p-2.5 text-left")}><div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/85"><Megaphone className="h-3.5 w-3.5 text-[color:var(--gold)]" />More</div><p className="line-clamp-2 text-[10px] text-foreground/45">{announcement || "Room controls & announcement"}</p></button></div>
      </div>
    </div>
    <div className="relative z-20 flex shrink-0 items-end gap-2 border-t border-[color:var(--primary)]/20 bg-background/95 px-2.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-auto">
      <div className="flex flex-1 items-center justify-around rounded-2xl border border-foreground/10 bg-[color:var(--card)]/70 px-1 py-1.5"><button type="button" onClick={tap(onHome)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><Home className="h-5 w-5" /><span className="text-[9px] font-semibold">Home</span></button><button type="button" onClick={tap(openGifts)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><Gift className="h-5 w-5" /><span className="text-[9px] font-semibold">Gifts</span></button><button type="button" onClick={tap(openGames)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><Gamepad2 className="h-5 w-5" /><span className="text-[9px] font-semibold">Game</span></button></div>
      {canSpeak ? <button type="button" onClick={tap(onToggleMic)} aria-label="Toggle microphone" style={OCTAGON} className={cn(buttonClass,"flex h-14 w-14 shrink-0 items-center justify-center border-2 active:scale-90",micOn?"border-[color:var(--primary)] bg-[color:var(--primary)] text-primary-foreground":"border-foreground/20 bg-[color:var(--card)] text-foreground")}>{micOn?<Mic className="h-6 w-6"/>:<MicOff className="h-6 w-6 text-foreground/60"/>}</button>:<div className="h-14 w-14 shrink-0"/>}
      <div className="flex flex-1 items-center justify-around rounded-2xl border border-foreground/10 bg-[color:var(--card)]/70 px-1 py-1.5"><button type="button" onClick={tap(openSeat)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><span className="grid h-5 w-5 place-items-center rounded-full border border-[color:var(--secondary)]/60 text-[10px] font-black">{mySeatIndex !== null ? mySeatIndex : "+"}</span><span className="text-[9px] font-semibold">{mySeatIndex !== null ? "Seat" : "Request"}</span></button><button type="button" onClick={tap(openRoomChat)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><MessageCircle className="h-5 w-5"/><span className="text-[9px] font-semibold">Chat</span></button><button type="button" onClick={tap(onOpenMore)} className={cn(buttonClass,"flex flex-col items-center gap-0.5 px-1 text-foreground/70")}><span className="text-lg leading-none">•••</span><span className="text-[9px] font-semibold">More</span></button></div>
    </div>
    <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} roomId={roomId} receivers={receivers} />
    <RoomGamesSheet open={gamesOpen} onClose={() => setGamesOpen(false)} onOpenNative={(slug) => { setGamesOpen(false); onOpenGames(); window.dispatchEvent(new CustomEvent("jalwa:open-game", { detail: { slug, roomId } })); }} />
  </main>;
};
