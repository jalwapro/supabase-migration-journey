import { useEffect, useMemo, useState } from "react";
import { Rocket, Gift, Gamepad2, MessageCircle, Smile, Send, Mail, Grid2X2, ChevronRight } from "lucide-react";
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

  return <main className="relative z-50 mx-auto flex h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden bg-[#07162d] text-foreground shadow-2xl">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(25,70,130,.34),transparent_30%),radial-gradient(circle_at_18%_48%,rgba(190,116,40,.08),transparent_18%),linear-gradient(180deg,#0a1932_0%,#071832_50%,#07142a_100%)]" />
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <RoomHeader room={room} roomCode={roomCode} onlineCount={onlineCount} topGifterName={topGifterName} topGifterCoins={topGifterCoins} onHostTap={onHostTap} onReport={onReport} onShare={onShare} onExit={onExit} onHome={onHome} onRanking={onRanking} />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(36,86,154,.12),transparent_48%)]">
          <SeatGrid seats={room.seats} seatCount={effectiveSeatCount} host={room.host} onSeatTap={onSeatTap} onJoinSeat={onJoinSeat} onHostTap={onHostTap} />
        </div>

        <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "mx-2 flex h-[clamp(36px,5.5dvh,48px)] shrink-0 items-center gap-2 overflow-hidden border-y border-fuchsia-400/35 bg-gradient-to-r from-[#541642]/95 via-[#402048]/95 to-[#20254b]/95 px-2.5 text-left shadow-[inset_0_1px_rgba(255,255,255,.08)]")}>
          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-[#c78b6a] bg-[#26142d]">{room.host.avatar ? <img src={room.host.avatar} alt="" className="h-full w-full object-cover" /> : "👑"}</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium tracking-wide text-white/90"><b>{room.host.username || "Host"}</b> enters the room</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
        </button>

        <section className="grid h-[clamp(120px,20dvh,172px)] shrink-0 grid-cols-[minmax(0,1.7fr)_minmax(80px,.7fr)] gap-1.5 px-2 py-1.5">
          <div className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#0b1a33]/90 shadow-[inset_0_0_30px_rgba(0,0,0,.12)]">
            <div className="flex h-8 shrink-0 items-end gap-5 border-b border-white/10 px-2.5"><button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "relative pb-1.5 text-xs font-semibold text-white")}>All<span className="absolute bottom-0 left-0 h-0.5 w-6 rounded-full bg-emerald-400" /></button><button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "pb-1.5 text-xs font-medium text-white/55")}>Chat</button></div>
            <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "flex min-h-0 flex-1 items-start overflow-hidden px-2.5 py-1.5 text-left")}><p className="line-clamp-3 rounded-xl border border-white/10 bg-white/[.025] px-2.5 py-1.5 text-[11px] leading-snug text-cyan-100/85">{announcement || "Welcome everyone. Please keep the room friendly and respectful."}</p></button>
            <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "mx-1.5 mb-1.5 flex h-8 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-2.5 text-left")}><span className="min-w-0 flex-1 truncate text-xs text-cyan-100/65">Say something...</span><Smile className="h-3.5 w-3.5 shrink-0 text-white/50" /><Send className="h-3.5 w-3.5 shrink-0 text-[color:var(--primary)]" /></button>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-1.5">
            <button type="button" onClick={tap(onRanking)} className={cn(buttonClass, "grid min-h-0 flex-1 place-items-center rounded-xl border border-amber-300/25 bg-[#101f3b]/82 p-1.5")}><span className="flex flex-col items-center"><Rocket className="h-7 w-7 text-amber-300"/><span className="mt-0.5 text-[9px] font-bold text-white/75">{popularityPct}% Popular</span></span></button>
            <button type="button" onClick={tap(openGames)} className={cn(buttonClass, "h-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(135deg,#e9d1a9,#845f67_48%,#372343)] px-1 text-[10px] font-black leading-tight text-white shadow-inner")}>Century Wedding</button>
          </div>
        </section>
      </div>
    </div>

    <nav className="relative z-20 flex h-[clamp(52px,7dvh,62px)] shrink-0 items-center justify-around border-t border-cyan-300/15 bg-[#0a1730]/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(0,0,0,.24)]">
      <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Chat"><MessageCircle className="h-4.5 w-4.5" /></button>
      <button type="button" onClick={tap(openGifts)} className={cn(buttonClass, "grid h-11 w-11 place-items-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-[0_0_18px_rgba(245,158,11,.35)]")} aria-label="Gifts"><Gift className="h-5.5 w-5.5" /></button>
      <button type="button" onClick={tap(openGames)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Game"><Gamepad2 className="h-4.5 w-4.5" /></button>
      <button type="button" onClick={tap(onOpenChat)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="Messages"><Mail className="h-4.5 w-4.5" /></button>
      <button type="button" onClick={tap(onOpenMore)} className={cn(buttonClass, "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.04] text-white/80")} aria-label="More"><Grid2X2 className="h-4.5 w-4.5" /></button>
    </nav>

    <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} roomId={roomId} receivers={receivers} />
    <RoomGamesSheet open={gamesOpen} onClose={() => setGamesOpen(false)} onOpenNative={(slug) => { setGamesOpen(false); onOpenGames(); window.dispatchEvent(new CustomEvent("jalwa:open-game", { detail: { slug, roomId } })); }} />
  </main>;
};
