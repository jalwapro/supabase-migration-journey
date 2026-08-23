import { Flag, Share2, Power, Trophy, Users, ChevronRight, Pencil, ImagePlus, Minimize2, LogOut, X } from "lucide-react";
import type { RoomState } from "@/types/room";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RoomHeaderProps { room: RoomState; roomCode: string; onlineCount: number; topGifterName?: string | null; topGifterCoins?: number; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; isHost?: boolean; }

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onHostTap, onReport, onShare, onExit, onHome, onRanking, isHost: isHostProp = false }: RoomHeaderProps) {
  const { user } = useAuth();
  const isHost = isHostProp || user?.id === room.host.id;
  const [roomTitle, setRoomTitle] = useState(room.title);
  const [roomDp, setRoomDp] = useState<string | null>(room.host.avatar);
  const [exitMenuOpen, setExitMenuOpen] = useState(false);
  const [hostExitConfirmOpen, setHostExitConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setRoomTitle(room.title), [room.title]);
  useEffect(() => setRoomDp(room.host.avatar), [room.host.avatar]);
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); handler(); };
  const hostName = room.host.username || "Host";
  const actionClass = "relative z-[62] grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/80 bg-[color:var(--secondary)]/30 text-white shadow-[0_1px_8px_rgba(0,0,0,.35)] touch-manipulation active:scale-95";
  const hostProfileClick = () => onHostTap ? onHostTap() : onHome();

  const saveRoomTitle = async () => {
    if (!isHost || !user?.id) return;
    const next = window.prompt("Room name", roomTitle)?.trim();
    if (!next || next === roomTitle) return;
    const { error } = await supabase.from("live_rooms").update({ title: next }).eq("id", room.id).eq("host_id", user.id);
    if (error) { toast.error(error.message || "Unable to change room name"); return; }
    setRoomTitle(next);
    toast.success("Room name updated");
  };

  const saveRoomDp = async (file: File) => {
    if (!isHost || !user?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Room image must be 5MB or smaller"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `room-covers/${room.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("room-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error(uploadError.message || "Unable to upload room image"); return; }
    const { data: publicData } = supabase.storage.from("room-assets").getPublicUrl(path);
    const url = publicData.publicUrl;
    const { error } = await supabase.from("live_rooms").update({ cover_url: url }).eq("id", room.id).eq("host_id", user.id);
    if (error) { toast.error(error.message || "Unable to save room image"); return; }
    setRoomDp(url);
    toast.success("Room DP updated");
  };

  const openExitMenu = () => setExitMenuOpen(true);
  const minimizeRoom = () => {
    setExitMenuOpen(false);
    onHome();
  };
  const exitRoom = () => {
    setExitMenuOpen(false);
    if (isHost) {
      setHostExitConfirmOpen(true);
      return;
    }
    onExit();
  };
  const confirmHostExit = () => {
    setHostExitConfirmOpen(false);
    onExit();
  };

  return <header className="relative z-[60] flex shrink-0 flex-col px-2 pt-[calc(.2rem+env(safe-area-inset-top))] sm:px-2.5" style={{ pointerEvents: "auto", backgroundColor: "var(--primary)" }}>
    <div className="relative z-[61] flex min-h-[56px] items-center gap-1.5">
      <div role="button" tabIndex={0} onClick={hostProfileClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") hostProfileClick(); }} className="relative z-[62] flex min-w-0 flex-1 items-center gap-2 rounded-[18px] border-2 border-[color:var(--secondary)]/75 bg-[color:var(--secondary)]/25 p-2 text-left shadow-[0_1px_10px_rgba(0,0,0,.35)] active:opacity-85" aria-label={`Open ${hostName} profile`}>
        {roomDp ? <img src={roomDp} alt="" className="h-11 w-11 shrink-0 rounded-[12px] border-2 border-[color:var(--secondary)] object-cover shadow-[0_1px_8px_rgba(0,0,0,.45)]" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border-2 border-[color:var(--secondary)] bg-black/15 text-sm font-black">{hostName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><div className="truncate text-[14px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.95)]">{roomTitle}</div>{isHost && <button type="button" aria-label="Change room name" onClick={tap(saveRoomTitle)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><Pencil className="h-3 w-3" /></button>}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]"><span className="inline-grid h-4 w-4 place-items-center rounded-full border border-[color:var(--secondary)] bg-[color:var(--secondary)]/70 text-[9px] text-white">◆</span><span className="truncate">ID:{roomCode}</span></div></div>
        {isHost && <button type="button" aria-label="Change room DP" onClick={tap(() => fileRef.current?.click())} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><ImagePlus className="h-3.5 w-3.5" /></button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void saveRoomDp(f); }} />
      {!isHost && <button type="button" onClick={tap(onReport)} className={actionClass} aria-label="Report room"><Flag className="h-4 w-4" /></button>}
      <button type="button" onClick={tap(onShare)} className={actionClass} aria-label="Share room"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={tap(openExitMenu)} className={actionClass} aria-label="Room exit options" aria-expanded={exitMenuOpen}><Power className="h-4 w-4" /></button>
    </div>
    <div className="relative z-[61] mt-0 flex min-h-[30px] items-center gap-1.5 border-b-2 border-[color:var(--secondary)]/80">
      <button type="button" onClick={tap(onRanking)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] active:opacity-80"><Trophy className="h-4 w-4 shrink-0 text-[color:var(--secondary)]"/><span className="truncate">{topGifterName ? `${topGifterName} · ${((topGifterCoins ?? 0) / 1000).toFixed(1)}k` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/90"/></button>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--secondary)]/80 bg-[color:var(--secondary)]/25 px-2 py-1 text-[10px] text-white shadow-[0_1px_6px_rgba(0,0,0,.35)]"><Users className="h-3.5 w-3.5"/><span>{onlineCount}</span></div>
    </div>
    {exitMenuOpen && <div className="fixed inset-0 z-[2147483000]" role="presentation">
      <button type="button" aria-label="Close room options" className="absolute inset-0 h-full w-full cursor-default bg-transparent" onClick={() => setExitMenuOpen(false)} tabIndex={-1} />
      <div className="absolute right-2 top-[calc(58px+env(safe-area-inset-top))] w-[190px] overflow-hidden rounded-2xl border border-white/30 bg-black/90 p-1.5 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()} role="menu" aria-label="Room options">
        <button type="button" onClick={tap(minimizeRoom)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white hover:bg-white/10" role="menuitem"><Minimize2 className="h-4 w-4 text-white/80"/><span>Minimize Room</span></button>
        <button type="button" onClick={tap(exitRoom)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-500/10" role="menuitem"><LogOut className="h-4 w-4"/><span>Exit Room</span></button>
      </div>
    </div>}
    {hostExitConfirmOpen && <div className="fixed inset-0 z-[2147483001] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="host-exit-title" onClick={() => setHostExitConfirmOpen(false)}>
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/95 p-5 text-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id="host-exit-title" className="text-lg font-black">Exit Room?</h2><p className="mt-1 text-sm leading-5 text-white/65">Are you sure you want to exit this room?</p></div>
          <button type="button" aria-label="Close" onClick={() => setHostExitConfirmOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70"><X className="h-4 w-4"/></button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setHostExitConfirmOpen(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white">No</button>
          <button type="button" onClick={confirmHostExit} className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white">Yes, Exit Room</button>
        </div>
      </div>
    </div>}
  </header>;
}
