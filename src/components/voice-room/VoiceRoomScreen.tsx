import { useEffect, useMemo, useState } from "react";
import { Rocket, Megaphone, Gift, Gamepad2, MessageCircle, Smile, Send, Mail, Grid2X2, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
import { RoomGamesSheet } from "@/components/room/RoomGamesSheet";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const normalizeCapacity = (value: unknown) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value)) || MAX_CAPACITY));

interface VoiceRoomScreenProps {
  room: RoomState; roomId: string; seatCount?: number; roomCode: string; onlineCount: number; micOn: boolean; isHost: boolean; mySeatIndex: number | null; popularityPct: number; topGifterName?: string | null; topGifterCoins?: number; announcement?: string | null;
  onOpenChat: () => void; onOpenPrivateChat: () => void; onOpenGift: () => void; onOpenMore: () => void; onToggleMic: () => void; onSeatTap: (index: number) => void; onJoinSeat: (index: number) => void; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; onOpenGames: () => void;
}

export const VoiceRoomScreen = ({ room, roomId, seatCount, roomCode, onlineCount, micOn, isHost, mySeatIndex, popularityPct, topGifterName, topGifterCoins, announcement, onOpenChat, onOpenPrivateChat, onOpenGift, onOpenMore, onToggleMic, onSeatTap, onJoinSeat, onHostTap, onReport, onShare, onExit, onHome, onRanking, onOpenGames }: VoiceRoomScreenProps) => {
  const [giftOpen, setGiftOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [liveSeatCount, setLiveSeatCount] = useState(() => normalizeCapacity(seatCount));
  const effectiveSeatCount = normalizeCapacity(seatCount ?? liveSeatCount);

  useEffect(() => {
    if (seatCount != null) { setLiveSeatCount(normalizeCapacity(seatCount)); return; }
    let active = true;
    void supabase.from("live_rooms").select("seat_count").eq("id", roomId).maybeSingle().then(({ data, error }) => {
      if (active && !error && data) setLiveSeatCount(normalizeCapacity((data as { seat_count?: number }).seat_count));
    });
    const channel = supabase.channel(`voice-layout-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (payload) => {
      const row = payload.new as { seat_count?: number };
      if (row.seat_count != null) setLiveSeatCount(normalizeCapacity(row.seat_count));
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, seatCount]);

  const tap = (handler: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); handler(); };
  const buttonClass = "touch-manipulation pointer-events-auto select-none active:scale-95 transition-transform";
  const receivers = useMemo<GiftReceiver[]>(() => {
    const seated = room.seats.filter((s) => s.user && s.user.id !== room.host.id).map((s) => ({ id: s.user!.id, username: s.user!.username, avatar: s.user!.avatar }));
    return room.host.id ? [{ id: room.host.id, username: room.host.username, avatar: room.host.avatar }, ...seated] : seated;
  }, [room]);
  const openGifts = () => { setGiftOpen(true); onOpenGift(); };
  const openGames = () => { setGamesOpen(true); onOpenGames(); };
  const openSeat = () => {
    if (mySeatIndex !== null) { onSeatTap(mySeatIndex); return; }
    const nextSeat = room.seats.find((seat) => seat.index >= 2 && seat.index <= effectiveSeatCount && !seat.user && !seat.is_locked);
    if (nextSeat) onJoinSeat(nextSeat.index);
  };

  return <main className="relative z-50 mx-auto flex h-[100dvh] min-h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-[#07162d] text-foreground shadow-2xl">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(25,70,130,.34),transparent_30%),radial-gradient(circle_at_18%_48%,rgba(190,116,40,.08),transparent_18%),linear-gradient(180deg,#0a1932_0%,#071832_50%,#07142a_100%)]" />
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <RoomHeader room={room} roomCode={roomCode} onlineCount={onlineCount} topGifterName={topGifterName} topGifterCoins={topGifterCoins} onHostTap={onHostTap} onReport={onReport} onShare={onShare} onExit={onExit} onHome={onHome} onRanking={onRanking} />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="relative shrink-0 bg-[radial-gradient(circle_at_50%_45%,rgba(36,86,154,.12),transparent_48%)]">
          <SeatGrid seats={room.seats} seatCount={effectiveSeatCount} host={room.host} onSeatTap={onSeatTap} onJoinSeat={onJoinSeat} onHostTap={onHostTap} />
        </div>

        <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "mx-2.5 flex min-h-[52px] shrink-0 items-center gap-2 overflow-hidden border-y border-fuchsia-400/35 bg-gradient-to-r from-[#541642]/95 via-[#402048]/95 to-[#20254b]/95 px-3 text-left shadow-[inset_0_1px_rgba(255,255,255,.08)]")}>
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#c78b6a] bg-[#26142d]">{room.host.avatar ? <img src={room.host.avatar} alt="" className="h-full w-full object-cover" /> : "👑"}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium tracking-wide text-white/90"><b>{room.host.username || "Host"}</b> enters the room</span>
          <ChevronRight className="h-4 w-4 text-white/50" />
        </button>

        <section className="grid min-h-[260px] shrink-0 grid-cols-[minmax(0,1.7fr)_minmax(112px,.7fr)] gap-2 px-2.5 py-2">
          <div className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#0b1a33]/90 shadow-[inset_0_0_30px_rgba(0,0,0,.12)]">
            <div className="flex h-10 shrink-0 items-end gap-7 border-b border-white/10 px-3"><button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "relative pb-2.5 text-sm font-semibold text-white")}>All<span className="absolute bottom-0 left-0 h-0.5 w-7 rounded-full bg-emerald-400" /></button><button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "pb-2.5 text-sm font-medium text-white/55")}>Chat</button></div>
            <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "flex flex-1 items-start px-3 py-2 text-left")}><p className="line-clamp-7 rounded-2xl border border-white/10 bg-white/[.025] px-3 py-2 text-[12px] leading-relaxed text-cyan-100/85">{announcement || "Welcome everyone. Please keep the room friendly and respectful. Follow the room rules and enjoy the live conversation."}</p></button>
            <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 text-left")}><span className="min-w-0 flex-1 truncate text-sm text-cyan-100/65">Say something...</span><Smile className="h-4 w-4 text-white/50" /><Send className="h-4 w-4 text-[color:var(--primary)]" /></button>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <button type="button" onClick={tap(onRanking)} className={cn(buttonClass, "grid min-h-[112px] place-items-center rounded-xl border border-amber-300/25 bg-[#101f3b]/82 p-2")}><span className="flex flex-col items-center"><Rocket className="h-9 w-9 text-amber-300"/><span className="mt-1 text-[10px] font-bold text-white/75">{popularityPct}% Popular</span></span></button>
            <button type="button" onClick={tap(openGames)} className={cn(buttonClass, "min-h-[74px] overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(135deg,#e9d1a9,#845f67_48%,#372343)] px-2 text-center text-xs font-black text-white shadow-inner")}>Century<br/>Wedding</button>
          </div>
        </section>

        <section className="mx-2.5 mb-2 flex min-h-[128px] shrink-0 overflow-hidden rounded-xl border border-emerald-300/20 bg-[linear-gradient(90deg,rgba(17,54,45,.9),rgba(16,43,42,.84))] shadow-[inset_0_0_25px_rgba(0,0,0,.1)]">
          <div className="flex min-w-0 flex-1 flex-col px-3 py-2.5"><p className="text-sm font-medium text-white/90">Ask your followers to support to make the room more popular</p><p className="mt-2 truncate text-sm text-cyan-200/90">{room.host.username || "Host"} enters the room</p><div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-2 text-sm text-white/80"><span className="min-w-0 flex-1">Completed magic quests to get energy rewards</span><button type="button" onClick={tap(onOpenMore)} className={cn(buttonClass, "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10")}><ChevronRight className="h-5 w-5" /></button></div></div>
        </section>
      </div>
    </div>

    <nav className="relative z-20 flex h-[76px] shrink-0 items-center justify-around border-t border-cyan-300/15 bg-[#0a1730]/98 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(0,0,0,.24)]">
      <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Chat"><MessageCircle className="h-6 w-6" /></button>
      <button type="button" onClick={tap(openGifts)} className={cn(buttonClass, "grid h-14 w-14 place-items-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-[0_0_18px_rgba(245,158,11,.35)]")} aria-label="Gifts"><Gift className="h-7 w-7" /></button>
      <button type="button" onClick={tap(openGames)} className={cn(buttonClass, "grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Game"><Gamepad2 className="h-6 w-6" /></button>
      <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Messages"><Mail className="h-6 w-6" /></button>
      <button type="button" onClick={tap(onOpenMore)} className={cn(buttonClass, "grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="More"><Grid2X2 className="h-6 w-6" /></button>
    </nav>

    <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} roomId={roomId} receivers={receivers} />
    <RoomGamesSheet open={gamesOpen} onClose={() => setGamesOpen(false)} onOpenNative={(slug) => { setGamesOpen(false); onOpenGames(); window.dispatchEvent(new CustomEvent("jalwa:open-game", { detail: { slug, roomId } })); }} />
  </main>;
};
