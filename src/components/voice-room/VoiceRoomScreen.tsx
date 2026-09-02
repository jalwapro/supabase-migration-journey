import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, Gamepad2, Smile, Send, Grid2X2, Mic, MicOff, Shield, MessageCircle, UserCheck, Lock, KeyRound, VolumeX, Volume2, Share2, Flag, LogOut, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { ChatEmojiSheet, type ChatEmoji } from "@/components/chat/ChatEmojiSheet";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
import { RoomGamesSheet } from "@/components/room/RoomGamesSheet";
import { GiftAnimationPlayer } from "@/components/room/GiftAnimationPlayer";
import { VoiceRoomMemberSheet, type VoiceRoomMemberProfile } from "./VoiceRoomMemberSheet";
import { ModeratorControls } from "./ModeratorControls";
import { HostRoomSettings } from "./HostRoomSettings";
import { HostPopularitySheet } from "./HostPopularitySheet";
import { JalwaPrivateChat } from "./JalwaPrivateChat";

const MIN_CAPACITY = 4, MAX_CAPACITY = 20;
const normalizeCapacity = (v: unknown) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(v)) || MAX_CAPACITY));

type HostTheme = { bg_image: string | null; animation_url: string | null; preview_url: string | null; primary_color: string | null; accent_color: string | null };
type RoomChatMessage = { id: string; user_id: string | null; text: string | null; message?: string | null; kind: string; created_at: string; sender_username?: string | null; sender_avatar?: string | null; user?: { username: string | null; avatar: string | null } | null; pending?: boolean; failed?: boolean; };
type RoomSettings = { is_locked: boolean; chat_enabled: boolean; gifts_enabled: boolean; guest_mic_enabled: boolean; room_pin?: string | null };
interface GameSlide { id: string; image_url: string; title: string; link_url?: string; }
interface VoiceRoomScreenProps { room: RoomState; roomId: string; seatCount?: number; roomCode: string; onlineCount: number; micOn: boolean; isHost: boolean; mySeatIndex: number | null; popularityPct: number; topGifterName?: string | null; topGifterCoins?: number; announcement?: string | null; messages?: RoomChatMessage[]; onOpenChat: () => void; onOpenPrivateChat: () => void; onOpenGift: () => void; onOpenMore: () => void; onToggleMic: () => void; speakerMuted: boolean; onToggleSpeaker: () => void; onOpenMusic?: () => void; onSendEmoji?: (emoji: ChatEmoji, targetSeatIndex?: number | null) => void; canPlayMusic?: boolean; onSeatTap: (i: number) => void; onJoinSeat: (i: number) => void; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; onOpenGames?: () => void; onOpenNativeGame?: (slug: string) => void; }
const DEFAULT_ROOM_SETTINGS: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true, room_pin: null };

export const VoiceRoomScreen = ({ room, roomId, seatCount, roomCode, onlineCount, micOn, isHost, mySeatIndex, popularityPct, topGifterName, topGifterCoins, announcement, messages = [], onOpenChat, onOpenPrivateChat, onOpenGift, onOpenMore, onToggleMic, onToggleSpeaker, speakerMuted, onSendEmoji, onSeatTap, onJoinSeat, onHostTap, onReport, onShare, onExit, onHome, onRanking, onOpenGames, onOpenNativeGame }: VoiceRoomScreenProps) => {
  const [giftOpen, setGiftOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [popularityOpen, setPopularityOpen] = useState(false);
  const [userMoreOpen, setUserMoreOpen] = useState(false);
  const [showMiniInputPopup, setShowMiniInputPopup] = useState(false);
  const [miniDraft, setMiniDraft] = useState("");
  const [privateChatOpen, setPrivateChatOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<VoiceRoomMemberProfile | null>(null);
  const [liveSeatCount, setLiveSeatCount] = useState(() => normalizeCapacity(seatCount));
  const [hostTheme, setHostTheme] = useState<HostTheme | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>(messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorControlsOpen, setModeratorControlsOpen] = useState(false);
  const [hostSettingsOpen, setHostSettingsOpen] = useState(false);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [showRocketAnimation, setShowRocketAnimation] = useState(false);
  const [showHostFreePopup, setShowHostFreePopup] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [isUnlockedByPin, setIsUnlockedByPin] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [selectedTargetSeat, setSelectedTargetSeat] = useState<number | null>(null);
  const [activeFlyingEmoji, setActiveFlyingEmoji] = useState<{ emojiUrl: string; fromSeat: number; toSeat: number } | null>(null);
  const [glowingSeatIndex, setGlowingSeatIndex] = useState<number | null>(null);
  const [gameSlides, setGameSlides] = useState<GameSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const effectiveSeatCount = normalizeCapacity(seatCount ?? liveSeatCount);

  // Global Escape & Back button handler
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      let closedSomething = false;
      if (generatedPin) { setGeneratedPin(null); closedSomething = true; }
      else if (privateChatOpen) { setPrivateChatOpen(false); closedSomething = true; }
      else if (giftOpen) { setGiftOpen(false); closedSomething = true; }
      else if (emojiOpen) { setEmojiOpen(false); setSelectedTargetSeat(null); closedSomething = true; }
      else if (gamesOpen) { setGamesOpen(false); closedSomething = true; }
      else if (popularityOpen) { setPopularityOpen(false); closedSomething = true; }
      else if (userMoreOpen) { setUserMoreOpen(false); closedSomething = true; }
      else if (showMiniInputPopup) { setShowMiniInputPopup(false); setMiniDraft(""); closedSomething = true; }
      else if (selectedMember) { setSelectedMember(null); closedSomething = true; }
      else if (hostSettingsOpen) { setHostSettingsOpen(false); closedSomething = true; }
      else if (moderatorControlsOpen) { setModeratorControlsOpen(false); closedSomething = true; }
      else if (showHostFreePopup) { setShowHostFreePopup(false); closedSomething = true; }
      else if (showPinModal) { setShowPinModal(false); setEnteredPin(""); closedSomething = true; }
      else if (showRocketAnimation) { setShowRocketAnimation(false); closedSomething = true; }
      
      if (closedSomething) { 
        e.preventDefault(); 
        window.history.pushState(null, "", window.location.href); 
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (generatedPin) setGeneratedPin(null);
        else if (privateChatOpen) setPrivateChatOpen(false);
        else if (giftOpen) setGiftOpen(false);
        else if (emojiOpen) { setEmojiOpen(false); setSelectedTargetSeat(null); }
        else if (gamesOpen) setGamesOpen(false);
        else if (popularityOpen) setPopularityOpen(false);
        else if (userMoreOpen) setUserMoreOpen(false);
        else if (showMiniInputPopup) { setShowMiniInputPopup(false); setMiniDraft(""); }
        else if (selectedMember) setSelectedMember(null);
        else if (hostSettingsOpen) setHostSettingsOpen(false);
        else if (moderatorControlsOpen) setModeratorControlsOpen(false);
        else if (showHostFreePopup) setShowHostFreePopup(false);
        else if (showPinModal) setShowPinModal(false);
        else if (showRocketAnimation) setShowRocketAnimation(false);
      }
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [privateChatOpen, giftOpen, emojiOpen, gamesOpen, popularityOpen, userMoreOpen, showMiniInputPopup, selectedMember, hostSettingsOpen, moderatorControlsOpen, generatedPin, showHostFreePopup, showPinModal, showRocketAnimation]);

  useEffect(() => { if (roomSettings.is_locked && !isHost && !isUnlockedByPin) setShowPinModal(true); else setShowPinModal(false); }, [roomSettings.is_locked, isHost, isUnlockedByPin]);
  useEffect(() => { let active = true; const fetchSlides = async () => { const { data, error } = await supabase.from("room_slides").select("id, title, image_url, link_url").eq("is_active", true).order("sort_order", { ascending: true }); if (active && !error && data && data.length > 0) setGameSlides(data); else if (active) setGameSlides([{ id: "1", title: "Jalwa Games", image_url: "/images/games/ludo-banner.jpg" }]); }; void fetchSlides(); const channel = supabase.channel("room-slides-sync").on("postgres_changes", { event: "*", schema: "public", table: "room_slides" }, () => void fetchSlides()).subscribe(); return () => { active = false; void supabase.removeChannel(channel); }; }, []);
  useEffect(() => { if (gameSlides.length <= 1) return; const slideInterval = setInterval(() => setCurrentSlideIndex(prev => (prev + 1) % gameSlides.length), 5000); return () => clearInterval(slideInterval); }, [gameSlides.length]);
  useEffect(() => { if (popularityPct >= 100 && isHost) setShowHostFreePopup(true); }, [popularityPct, isHost]);
  useEffect(() => { let active = true; const syncRole = async () => { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { if (active) setIsModerator(false); return; } const { data } = await supabase.from("room_members").select("is_moderator").eq("room_id", roomId).eq("user_id", auth.user.id).maybeSingle(); if (active) setIsModerator(!isHost && !!data?.is_moderator); }; void syncRole(); const channel = supabase.channel(`voice-role-${roomId}`).on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => void syncRole()).subscribe(); return () => { active = false; void supabase.removeChannel(channel); }; }, [roomId, isHost]);
  useEffect(() => { let active = true; const syncSettings = async () => { const { data, error } = await supabase.from("live_rooms").select("is_locked,chat_enabled,gifts_enabled,guest_mic_enabled,room_pin,seat_count").eq("id", roomId).maybeSingle(); if (active && !error && data) { setRoomSettings(prev => ({ ...prev, ...data } as RoomSettings)); if (data.seat_count != null) setLiveSeatCount(normalizeCapacity(data.seat_count)); } }; void syncSettings(); const channel = supabase.channel(`voice-room-settings-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => { const row = payload.new as Partial<RoomSettings & { seat_count?: number }>; if (active) { setRoomSettings(prev => ({ ...prev, ...row })); if (row.seat_count != null) setLiveSeatCount(normalizeCapacity(row.seat_count)); } }).subscribe(); return () => { active = false; void supabase.removeChannel(channel); }; }, [roomId]);
  useEffect(() => { if (!isModerator) setModeratorControlsOpen(false); }, [isModerator]); 
  useEffect(() => { if (!isHost) setHostSettingsOpen(false); }, [isHost]);
  useEffect(() => { if (!messages.length) return; setRoomMessages(prev => { const map = new Map(prev.map(m => [m.id, m])); messages.forEach(m => map.set(m.id, m)); return Array.from(map.values()).slice(-50); }); }, [messages]);
  useEffect(() => { let active = true; const channel = supabase.channel(`voice-chat-${roomId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => { const row = p.new as RoomChatMessage; if (active) setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev.filter(m => !m.pending), row].slice(-50)); }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => { const row = p.new as RoomChatMessage; if (active) setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev.map(m => m.id === row.id ? { ...m, ...row, pending: false, failed: false } : m) : [...prev, row].slice(-50)); }).on("postgres_changes", { event: "DELETE", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => { const row = p.old as { id: string }; if (active) setRoomMessages(prev => prev.filter(m => m.id !== row.id)); }).subscribe(); return () => { active = false; void supabase.removeChannel(channel); }; }, [roomId]);
  useEffect(() => { let active = true; void supabase.from("room_messages").select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar").eq("room_id", roomId).order("created_at", { ascending: true }).limit(50).then(({ data }) => { if (active && data) setRoomMessages(data as RoomChatMessage[]); }); return () => { active = false; }; }, [roomId]);
  useEffect(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; }, [roomMessages]);
  
  const sendRoomMessage = async () => { 
    const value = draft.trim(); 
    if (!value || sending || !roomSettings.chat_enabled) return; 
    setSending(true); 
    setDraft(""); 
    const { data: auth } = await supabase.auth.getUser(); 
    const user = auth.user; 
    if (!user) { setDraft(value); setSending(false); return; } 
    const localId = `local-${crypto.randomUUID()}`; 
    setRoomMessages(prev => [...prev, { id: localId, user_id: user.id, kind: "text", text: value, created_at: new Date().toISOString(), pending: true }].slice(-50)); 
    const { data, error } = await supabase.from("room_messages").insert({ room_id: roomId, user_id: user.id, kind: "text", text: value, client_id: crypto.randomUUID() }).select("id, user_id, kind, text, message, created_at, sender_username, sender_avatar").single(); 
    if (error) { 
      setRoomMessages(prev => prev.map(m => m.id === localId ? { ...m, pending: false, failed: true } : m)); 
      setDraft(value); 
    } else if (data) {
      setRoomMessages(prev => [...prev.filter(m => m.id !== localId), data as RoomChatMessage].slice(-50)); 
    }
    setSending(false); 
  };

  useEffect(() => { let cancelled = false; void supabase.from("profiles").select("theme_id").eq("id", room.host.id).maybeSingle().then(async ({ data }) => { if (cancelled || !data?.theme_id) return; const { data: theme } = await supabase.from("themes").select("bg_image,animation_url,preview_url,primary_color,accent_color").eq("id", data.theme_id).maybeSingle(); if (!cancelled) setHostTheme(theme as HostTheme | null); }); return () => { cancelled = true; }; }, [room.host.id]);
  
  const tap = (h: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); h(); };
  const buttonClass = "touch-manipulation pointer-events-auto select-none active:scale-95 transition-transform";
  
  const receivers = useMemo<GiftReceiver[]>(() => { 
    const list: GiftReceiver[] = []; 
    if (room.host?.id) list.push({ id: room.host.id, username: room.host.username ?? "Host", avatar: room.host.avatar ?? null }); 
    for (const seat of room.seats) { if (!seat.user?.id || seat.user.id === room.host.id) continue; list.push({ id: seat.user.id, username: seat.user.username, avatar: seat.user.avatar }); } 
    const seen = new Set<string>(); 
    return list.filter(u => !seen.has(u.id) && seen.add(u.id)); 
  }, [room.host, room.seats]);

  const openGifts = () => { if (!roomSettings.gifts_enabled) return; setGiftOpen(true); onOpenGift(); };
  const openAnimatedEmojis = (e?: React.SyntheticEvent) => { e?.preventDefault(); e?.stopPropagation(); setEmojiOpen(true); };
  const openGamesModal = (e?: React.SyntheticEvent) => { e?.preventDefault(); e?.stopPropagation(); setGamesOpen(true); onOpenGames?.(); };
  const openPopularity = () => setPopularityOpen(true);
  const openMoreForRole = () => { if (isHost) setHostSettingsOpen(true); else if (isModerator) setModeratorControlsOpen(true); else setUserMoreOpen(true); };
  const joinSeat = (index: number) => { if (roomSettings.is_locked && !isHost && !isUnlockedByPin) { setShowPinModal(true); return; } onJoinSeat(index); };
  
  const hostMedia = hostTheme?.bg_image || hostTheme?.animation_url || hostTheme?.preview_url;
  const primaryThemeColor = hostTheme?.primary_color || "#f59e0b"; // fallback amber
  const accentThemeColor = hostTheme?.accent_color || "#a855f7"; // fallback purple

  const visibleMessages = roomMessages.filter(m => m.kind !== "emoji");
  const openMemberProfile = (seatIndex: number) => { const seat = room.seats.find(s => s.index === seatIndex); if (!seat?.user) return; setMiniDraft(`@${seat.user.username} `); setShowMiniInputPopup(true); setSelectedMember({ id: seat.user.id, username: seat.user.username, avatar: seat.user.avatar, level: seat.user.level, gift_score: seat.user.gift_score, is_muted: seat.user.is_muted }); };
  const currentSlide = gameSlides[currentSlideIndex] || gameSlides[0];
  
  const handlePickEmoji = (emoji: ChatEmoji) => { 
    const targetSeat = selectedTargetSeat, senderSeat = mySeatIndex ?? 0; 
    onSendEmoji?.(emoji, targetSeat); 
    setEmojiOpen(false); 
    setSelectedTargetSeat(null); 
    if (targetSeat !== null && targetSeat !== undefined) { 
      setActiveFlyingEmoji({ emojiUrl: emoji.url || "", fromSeat: senderSeat, toSeat: targetSeat }); 
      setGlowingSeatIndex(targetSeat); 
      setTimeout(() => setActiveFlyingEmoji(null), 1500); 
      setTimeout(() => setGlowingSeatIndex(null), 3000); 
    } 
  };

  return (
    <main className="fixed inset-0 z-50 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden bg-slate-950 text-foreground shadow-2xl h-[100svh]">
      {hostMedia ? <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden"><img src={hostMedia} alt="" draggable={false} className="h-full w-full object-cover opacity-90" /></div> : null}
      
      {showPinModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md px-4 animate-fade-in">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900/90 border p-6 shadow-2xl text-center backdrop-blur-xl" style={{ borderColor: `${primaryThemeColor}66` }}>
            <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: `${primaryThemeColor}20`, color: primaryThemeColor, border: `1px solid ${primaryThemeColor}` }}>
              <Lock className="h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-lg font-black" style={{ color: primaryThemeColor }}>Room is Locked! 🔒</h3>
            <p className="mt-1 text-xs text-slate-300">Yeh room lock hai. Enter karne ke liye Host ka diya hua code enter karein:</p>
            <input type="password" maxLength={6} value={enteredPin} onChange={e => setEnteredPin(e.target.value)} placeholder="Enter Room PIN..." className="mt-4 w-full px-4 py-3 rounded-xl bg-black/60 border border-white/20 text-center text-white tracking-widest font-bold text-lg outline-none focus:border-amber-400" />
            <div className="mt-6 flex gap-3 w-full">
              <button type="button" onClick={() => { if (enteredPin.trim() === roomSettings.room_pin) { setIsUnlockedByPin(true); setShowPinModal(false); } else { alert("Incorrect Room PIN! Please try again."); } }} className="flex-1 py-3 rounded-xl text-white font-bold text-xs shadow-lg active:scale-95 transition-transform" style={{ background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor})` }}>Enter Room ✨</button>
              <button type="button" onClick={() => { setShowPinModal(false); onHome(); }} className="px-4 py-3 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs active:scale-95 transition-transform">Leave</button>
            </div>
          </div>
        </div>
      )}

      {generatedPin && isHost && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-md px-4 animate-fade-in">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900/90 border p-6 shadow-2xl text-center backdrop-blur-xl" style={{ borderColor: `${accentThemeColor}66` }}>
            <div className="h-14 w-14 rounded-full flex items-center justify-center mb-3 shadow-lg" style={{ backgroundColor: `${accentThemeColor}20`, color: accentThemeColor, border: `1px solid ${accentThemeColor}` }}>
              <KeyRound className="h-7 w-7" />
            </div>
            <h3 className="text-base font-black" style={{ color: accentThemeColor }}>New Room Code Generated!</h3>
            <p className="mt-1 text-xs text-slate-300">Aapka room lock ho chuka hai. Naya Secret Code yeh hai:</p>
            <div className="my-4 px-6 py-2 rounded-xl bg-black/80 border text-2xl font-black tracking-widest shadow-inner" style={{ borderColor: `${primaryThemeColor}88`, color: primaryThemeColor }}>{generatedPin}</div>
            <button type="button" onClick={() => setGeneratedPin(null)} className="w-full py-3 rounded-xl text-white font-bold text-xs shadow-lg active:scale-95 transition-transform" style={{ background: `linear-gradient(90deg, ${accentThemeColor}, ${primaryThemeColor})` }}>Okay, Got It 👍</button>
          </div>
        </div>
      )}

      {showHostFreePopup && isHost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in px-4">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900/90 border p-6 shadow-2xl text-center backdrop-blur-xl" style={{ borderColor: `${primaryThemeColor}66` }}>
            <div className="absolute -top-10 animate-bounce">
              <div className="h-20 w-20 rounded-full p-1 shadow-xl" style={{ background: `linear-gradient(135deg, ${primaryThemeColor}, ${accentThemeColor})` }}>
                <div className="h-full w-full rounded-full bg-black flex items-center justify-center overflow-hidden"><img src="/images/jalwa-1.gif" alt="Rocket GIF" className="h-14 w-14 object-contain" /></div>
              </div>
            </div>
            <h3 className="mt-8 text-lg font-black" style={{ color: primaryThemeColor }}>Room Popularity 100% Reached!</h3>
            <p className="mt-2 text-xs text-slate-300">Host! Aapka Jalwa Rocket trigger ho chuka hai. Free (0 Coins) mein play karein!</p>
            <div className="mt-6 flex gap-3 w-full">
              <button type="button" onClick={() => { setShowHostFreePopup(false); setShowRocketAnimation(true); setTimeout(() => setShowRocketAnimation(false), 5000); }} className="flex-1 py-3 rounded-xl text-white font-bold text-xs shadow-lg active:scale-95 transition-transform" style={{ background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor})` }}>Play Free (0 Coins) 🚀</button>
              <button type="button" onClick={() => setShowHostFreePopup(false)} className="px-4 py-3 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs active:scale-95 transition-transform">Close</button>
            </div>
          </div>
        </div>
      )}

      {showRocketAnimation && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center">
            <div className="relative animate-bounce">
              <div className="absolute -inset-8 rounded-full opacity-90 blur-2xl animate-pulse" style={{ background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor})` }} />
              <div className="relative grid h-52 w-52 place-items-center p-2"><img src="/images/jalwa-1.gif" alt="Jalwa Rocket GIF" className="h-full w-full object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.9)] animate-pulse" /></div>
            </div>
            <h2 className="mt-6 text-xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style={{ color: primaryThemeColor }}>🚀 JALWA ROCKET LAUNCHED! 100% POPULAR! 🚀</h2>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <div className="shrink-0 pt-2 px-3"><RoomHeader room={room} roomCode={roomCode} onlineCount={onlineCount} topGifterName={topGifterName} topGifterCoins={topGifterCoins} onHostTap={onHostTap} onReport={onReport} onShare={onShare} onExit={onExit} onHome={onHome} onRanking={onRanking} /></div>
        <GiftAnimationPlayer roomId={roomId} />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden justify-between">
          <div className="relative flex-1 min-h-0 overflow-y-auto bg-transparent pt-1 px-1 no-scrollbar">
            <SeatGrid seats={room.seats.map(s => ({ ...s, className: s.index === glowingSeatIndex ? "ring-4 ring-amber-400 shadow-[0_0_25px_rgba(234,179,8,0.9)] scale-105 transition-all duration-300" : "" }))} seatCount={effectiveSeatCount} host={room.host} roomId={roomId} isHost={isHost} onSeatTap={openMemberProfile} onJoinSeat={joinSeat} onHostTap={onHostTap} />
          </div>
          
          {activeFlyingEmoji && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-ping absolute h-16 w-16 rounded-full bg-amber-400 opacity-75" />
              <img src={activeFlyingEmoji.emojiUrl} alt="" className="h-16 w-16 object-contain animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,1)]" />
            </div>
          )}

          <div className="shrink-0 flex flex-col gap-1.5 px-3 pb-1">
            <section className="grid grid-cols-[minmax(0,1.7fr)_minmax(85px,.7fr)] gap-1.5">
              <div className="flex min-w-0 max-h-[190px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-black/50 backdrop-blur-xl shadow-xl">
                <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-white/10 px-2 bg-amber-500/10 text-amber-200">
                  <span className="text-[10px]">📢</span>
                  <p className="text-[9px] font-semibold truncate flex-1">{announcement || "Welcome to the room! Follow rules."}</p>
                </div>
                <div ref={chatContainerRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1 space-y-1 no-scrollbar scroll-smooth">
                  {visibleMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-white/40"><p className="text-[10px] font-medium">{announcement || "Welcome to the room!"}</p></div>
                  ) : (
                    visibleMessages.map(m => { 
                      const avatar = m.user?.avatar || m.sender_avatar;
                      const fallback = (m.user?.username || m.sender_username || "U").trim().charAt(0).toUpperCase(); 
                      return (
                        <div key={m.id} className="flex min-w-0 items-start gap-1 text-[10px]">
                          <div className="grid h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full bg-amber-500/20 text-[7px] font-bold text-amber-300 place-items-center border border-amber-500/30">
                            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} /> : fallback}
                          </div>
                          <span className="min-w-0 break-words text-white/90">{m.text || m.message || ""}</span>
                        </div>
                      ); 
                    })
                  )}
                </div>
                <div onClick={() => { if (!roomSettings.chat_enabled) return; setShowMiniInputPopup(true); }} className={cn("mx-1.5 mb-1.5 flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 shadow-inner cursor-pointer select-none", !roomSettings.chat_enabled && "opacity-50")}>
                  <span className="min-w-0 flex-1 text-[10px] font-medium text-white/40 truncate">{roomSettings.chat_enabled ? "Say something..." : "Chat disabled"}</span>
                  <Smile className="h-3 w-3 shrink-0" style={{ color: primaryThemeColor }} />
                </div>
              </div>
              <div className="flex min-w-0 flex-col justify-between items-end gap-1 max-h-[190px]">
                <button type="button" onClick={tap(openPopularity)} style={{ height: "75px" }} className={cn(buttonClass, "relative group flex items-center justify-center bg-transparent border-0 p-0 w-full shrink-0 shadow-none")}>
                  <div className="relative h-[75px] w-[75px] flex items-center justify-center">
                    <img src="/images/jalwa-1.gif" alt="Rocket GIF" className="h-[75px] w-[75px] object-contain animate-bounce drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                  </div>
                </button>
                <div style={{ height: "105px" }} className="relative w-full shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black/50 backdrop-blur-md flex items-center justify-center shadow-lg">
                  {currentSlide && <img src={currentSlide.image_url} alt={currentSlide.title} className="h-full w-full object-cover rounded-xl" />}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <nav style={{ backgroundColor: "rgba(10, 10, 15, 0.95)" }} className="relative z-20 flex h-[52px] shrink-0 items-center justify-around border-t border-white/15 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <button type="button" onClick={tap(onToggleMic)} disabled={!isHost && !roomSettings.guest_mic_enabled} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white disabled:opacity-40")} aria-label={micOn ? "Mute microphone" : "Unmute microphone"}>{micOn ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-rose-400" />}</button>
        <button type="button" onClick={openAnimatedEmojis} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label="Animated Emojis" aria-expanded={emojiOpen}><Smile className="h-3.5 w-3.5" style={{ color: primaryThemeColor }} /></button>
        <button type="button" onClick={openGamesModal} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label="Games" aria-expanded={gamesOpen}><Gamepad2 className="h-3.5 w-3.5" style={{ color: accentThemeColor }} /></button>
        <button type="button" onClick={tap(() => setPrivateChatOpen(true))} className={cn(buttonClass,"grid h-9 w-9 place-items-center rounded-full border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-md")} aria-label="Private Chat"><MessageCircle className="h-4 w-4" /></button>
        <button type="button" onClick={tap(openGifts)} disabled={!roomSettings.gifts_enabled} className={cn(buttonClass, "relative group grid h-10 w-10 place-items-center rounded-2xl p-0.5 shadow-[0_0_15px_rgba(234,179,8,0.5)] border border-white/40 disabled:opacity-40")} style={{ background: `linear-gradient(135deg, ${primaryThemeColor}, ${accentThemeColor})` }} aria-label={roomSettings.gifts_enabled ? "Gifts" : "Gifts disabled"}>
          <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="grid h-full w-full place-items-center rounded-[12px] bg-black/60 backdrop-blur-sm text-amber-200"><Gift className="h-4.5 w-4.5 animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ color: primaryThemeColor }} /></div>
        </button>
        <button type="button" onClick={openMoreForRole} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label={isHost ? "Host Room Settings" : isModerator ? "Moderator Controls" : "More"}>{isHost ? <Shield className="h-3.5 w-3.5" style={{ color: primaryThemeColor }} /> : isModerator ? <Shield className="h-3.5 w-3.5 text-cyan-400" /> : <Grid2X2 className="h-3.5 w-3.5 text-white" />}</button>
      </nav>

      <JalwaPrivateChat open={privateChatOpen} onClose={() => setPrivateChatOpen(false)} />
      
      {showMiniInputPopup && (
        <div className="absolute inset-0 z-[2147483500] flex items-end justify-center bg-black/30 backdrop-blur-md animate-fade-in p-0" onClick={() => setShowMiniInputPopup(false)}>
          <div className="w-full max-w-[480px] bg-[#120a1f]/90 border-t p-2.5 rounded-t-2xl shadow-2xl flex items-center gap-2 animate-slide-up backdrop-blur-xl" style={{ borderColor: `${primaryThemeColor}66` }} onClick={e => e.stopPropagation()}>
            <input value={miniDraft} onChange={e => setMiniDraft(e.target.value.slice(0, 500))} onKeyDown={async e => { if (e.key === "Enter") { e.preventDefault(); if (!miniDraft.trim()) return; setDraft(miniDraft); setShowMiniInputPopup(false); setMiniDraft(""); await sendRoomMessage(); } }} placeholder="Type a comment..." autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send" inputMode="url" className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs font-medium text-white placeholder:text-white/40 outline-none" style={{ focusBorderColor: primaryThemeColor }} />
            <button type="button" onClick={async () => { if (!miniDraft.trim()) return; setDraft(miniDraft); setShowMiniInputPopup(false); setMiniDraft(""); await sendRoomMessage(); }} className="px-4 py-2 rounded-xl text-white font-extrabold text-xs shadow-lg active:scale-95 transition" style={{ background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor})` }}>Send</button>
          </div>
        </div>
      )}

      {giftOpen && <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} roomId={roomId} receivers={receivers} />}
      
      {emojiOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30 backdrop-blur-md animate-fade-in">
          <div className="absolute inset-0" onClick={() => setEmojiOpen(false)} />
          <div className="relative z-10 w-full rounded-t-3xl bg-slate-900/90 border-t p-4 shadow-2xl backdrop-blur-xl animate-slide-up max-h-[60dvh] flex flex-col" style={{ borderColor: `${primaryThemeColor}55` }}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-700" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2"><Smile className="h-4 w-4" style={{ color: primaryThemeColor }} /><span className="text-xs font-bold tracking-wide uppercase" style={{ color: primaryThemeColor }}>Send Emoji to Seat</span></div>
              <button type="button" onClick={() => setEmojiOpen(false)} className="text-xs font-semibold text-slate-400 hover:text-white">Close</button>
            </div>
            <div className="py-2.5 border-b border-slate-800/80">
              <p className="text-[10px] text-slate-400 mb-2 font-medium">Select Target Seat (Optional):</p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button type="button" onClick={() => setSelectedTargetSeat(null)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border", selectedTargetSeat === null ? "text-white border-transparent shadow-md" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700")} style={selectedTargetSeat === null ? { background: primaryThemeColor, color: "#000" } : {}}>General Chat</button>
                {room.seats.map(seat => (
                  <button key={seat.index} type="button" onClick={() => setSelectedTargetSeat(seat.index)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all border", selectedTargetSeat === seat.index ? "text-white border-transparent shadow-md" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700")} style={selectedTargetSeat === seat.index ? { background: primaryThemeColor, color: "#000" } : {}}>
                    <UserCheck className="h-3 w-3" /><span>Seat {seat.index + 1} {seat.user?.username ? `(${seat.user.username})` : "(Empty)"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-3"><ChatEmojiSheet open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={handlePickEmoji} /></div>
          </div>
        </div>
      )}

      {userMoreOpen && (
        <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/30 p-0 backdrop-blur-md animate-fade-in" onClick={() => setUserMoreOpen(false)}>
          <div className="w-full max-w-sm rounded-t-3xl border-t border-x border-white/20 bg-[#100719]/90 p-4 text-white shadow-2xl backdrop-blur-xl flex flex-col animate-slide-up" style={{ borderColor: `${accentThemeColor}55` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2"><Info className="h-4 w-4" style={{ color: accentThemeColor }} /><h3 className="text-xs font-black uppercase tracking-wider" style={{ color: accentThemeColor }}>Room Options</h3></div>
            </div>
            <div className="py-4 space-y-2 text-xs">
              <button type="button" onClick={() => onToggleSpeaker()} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${speakerMuted ? "bg-rose-500/20 text-rose-300" : "bg-cyan-500/20 text-cyan-300"}`}>{speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</div>
                  <div className="text-left"><p className="font-bold text-white">Speaker Output</p><p className="text-[10px] text-white/50">{speakerMuted ? "Awaaz band hai (Muted)" : "Awaaz chalu hai"}</p></div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${speakerMuted ? "bg-rose-500/30 text-rose-300" : "bg-cyan-500/30 text-cyan-300"}`}>{speakerMuted ? "Unmute" : "Mute"}</span>
              </button>
              <button type="button" onClick={() => { setUserMoreOpen(false); onShare(); }} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300"><Share2 className="h-4 w-4" /></div>
                  <div className="text-left"><p className="font-bold text-white">Share Room</p><p className="text-[10px] text-white/50">Doston ke sath room link share karein</p></div>
                </div>
                <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-lg">Share</span>
              </button>
              <button type="button" onClick={() => { setUserMoreOpen(false); onReport(); }} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300"><Flag className="h-4 w-4" /></div>
                  <div className="text-left"><p className="font-bold text-white">Report Room</p><p className="text-[10px] text-white/50">Agar koi kharabi ya violation hai</p></div>
                </div>
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg">Report</span>
              </button>
            </div>
            <button type="button" onClick={() => { setUserMoreOpen(false); onExit(); }} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-2"><LogOut className="h-4 w-4" /><span>Leave Room</span></button>
          </div>
        </div>
      )}

      {gamesOpen && <RoomGamesSheet open={gamesOpen} onClose={() => setGamesOpen(false)} onOpenNative={slug => { setGamesOpen(false); onOpenNativeGame?.(slug); }} />}
      {popularityOpen && <HostPopularitySheet roomId={roomId} open={popularityOpen} onClose={() => setPopularityOpen(false)} popularityPct={popularityPct} hostName={room.host?.username} />}
      {selectedMember && <VoiceRoomMemberSheet member={selectedMember} canModerate={isHost} isHost={isHost} onClose={() => setSelectedMember(null)} />}
      {isHost && <HostRoomSettings roomId={roomId} open={hostSettingsOpen} onClose={() => setHostSettingsOpen(false)} onSettingsChange={setRoomSettings} speakerMuted={speakerMuted} onToggleSpeaker={onToggleSpeaker} />}
      {isModerator && <ModeratorControls roomId={roomId} open={moderatorControlsOpen} onClose={() => setModeratorControlsOpen(false)} />}
    </main>
  );
};
