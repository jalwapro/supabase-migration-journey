import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, Gamepad2, Smile, Send, Grid2X2, Mic, MicOff, Shield, MessageCircle, UserCheck, Lock, KeyRound } from "lucide-react";
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

const MIN_CAPACITY = 4, MAX_CAPACITY = 20;
const normalizeCapacity = (v: unknown) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(v)) || MAX_CAPACITY));

type HostTheme = { bg_image: string | null; animation_url: string | null; preview_url: string | null; primary_color: string | null; accent_color: string | null };
type RoomChatMessage = { 
  id: string; 
  user_id: string | null; 
  text: string | null; 
  message?: string | null; 
  kind: string; 
  created_at: string; 
  sender_username?: string | null; 
  sender_avatar?: string | null; 
  user?: { username: string | null; avatar: string | null } | null; 
  pending?: boolean; 
  failed?: boolean; 
};
type RoomSettings = { is_locked: boolean; chat_enabled: boolean; gifts_enabled: boolean; guest_mic_enabled: boolean; room_pin?: string | null };

interface GameSlide {
  id: string;
  image_url: string;
  title: string;
  link_url?: string;
}

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
  onSendEmoji?: (emoji: ChatEmoji, targetSeatIndex?: number | null) => void;
  canPlayMusic?: boolean;
  onSeatTap: (i: number) => void;
  onJoinSeat: (i: number) => void;
  onHostTap?: () => void;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onHome: () => void;
  onRanking: () => void;
  onOpenGames?: () => void;
  onOpenNativeGame?: (slug: string) => void;
}

const DEFAULT_ROOM_SETTINGS: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true, room_pin: null };

export const VoiceRoomScreen = ({
  room,
  roomId,
  seatCount,
  roomCode,
  onlineCount,
  micOn,
  isHost,
  mySeatIndex,
  popularityPct,
  topGifterName,
  topGifterCoins,
  announcement,
  messages = [],
  onOpenChat,
  onOpenPrivateChat,
  onOpenGift,
  onOpenMore,
  onToggleMic,
  onSendEmoji,
  onSeatTap,
  onJoinSeat,
  onHostTap,
  onReport,
  onShare,
  onExit,
  onHome,
  onRanking,
  onOpenGames,
  onOpenNativeGame
}: VoiceRoomScreenProps) => {
  const [giftOpen, setGiftOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [popularityOpen, setPopularityOpen] = useState(false);
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

  useEffect(() => {
    if (roomSettings.is_locked && !isHost && !isUnlockedByPin) {
      setShowPinModal(true);
    } else {
      setShowPinModal(false);
    }
  }, [roomSettings.is_locked, isHost, isUnlockedByPin]);

  useEffect(() => {
    let active = true;
    const fetchSlides = async () => {
      const { data, error } = await supabase
        .from("room_slides")
        .select("id, title, image_url, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (active && !error && data && data.length > 0) {
        setGameSlides(data);
      } else if (active) {
        setGameSlides([{ id: "1", title: "Jalwa Games", image_url: "/images/games/ludo-banner.jpg" }]);
      }
    };
    void fetchSlides();
    const channel = supabase.channel("room-slides-sync").on("postgres_changes", { event: "*", schema: "public", table: "room_slides" }, () => {
      void fetchSlides();
    }).subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (gameSlides.length <= 1) return;
    const slideInterval = setInterval(() => {
      setCurrentSlideIndex((prevIndex) => 
        (prevIndex + 1) % gameSlides.length
      );
    }, 5000);
    return () => clearInterval(slideInterval);
  }, [gameSlides.length]);

  useEffect(() => {
    if (popularityPct >= 100 && isHost) {
      setShowHostFreePopup(true);
    }
  }, [popularityPct, isHost]);

  useEffect(() => {
    let active = true;
    const syncRole = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setIsModerator(false);
        return;
      }
      const { data } = await supabase.from("room_members").select("is_moderator").eq("room_id", roomId).eq("user_id", auth.user.id).maybeSingle();
      if (active) setIsModerator(!isHost && !!data?.is_moderator);
    };
    void syncRole();
    const channel = supabase
      .channel(`voice-role-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => void syncRole())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId, isHost]);

  useEffect(() => {
    let active = true;
    const syncSettings = async () => {
      const { data, error } = await supabase.from("live_rooms").select("is_locked,chat_enabled,gifts_enabled,guest_mic_enabled,room_pin,seat_count").eq("id", roomId).maybeSingle();
      if (active && !error && data) {
        setRoomSettings(prev => ({ ...prev, ...data } as RoomSettings));
        if (data.seat_count != null) {
          setLiveSeatCount(normalizeCapacity(data.seat_count));
        }
      }
    };
    void syncSettings();
    const channel = supabase.channel(`voice-room-settings-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => {
      const row = payload.new as Partial<RoomSettings & { seat_count?: number }>;
      if (active) {
        setRoomSettings(prev => ({ ...prev, ...row }));
        if (row.seat_count != null) {
          setLiveSeatCount(normalizeCapacity(row.seat_count));
        }
      }
    }).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => { if (!isModerator) setModeratorControlsOpen(false); }, [isModerator]);
  useEffect(() => { if (!isHost) setHostSettingsOpen(false); }, [isHost]);
  useEffect(() => {
    if (!messages.length) return;
    setRoomMessages(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      messages.forEach(m => map.set(m.id, m));
      return Array.from(map.values()).slice(-50);
    });
  }, [messages]);

  useEffect(() => {
    let active = true;
    const channel = supabase.channel(`voice-chat-${roomId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => {
      const row = p.new as RoomChatMessage;
      if (active) setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev.filter(m => !m.pending), row].slice(-50));
    }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => {
      const row = p.new as RoomChatMessage;
      if (active) setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev.map(m => m.id === row.id ? { ...m, ...row, pending: false, failed: false } : m) : [...prev, row].slice(-50));
    }).on("postgres_changes", { event: "DELETE", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, p => {
      const row = p.old as { id: string };
      if (active) setRoomMessages(prev => prev.filter(m => m.id !== row.id));
    }).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    let active = true;
    void supabase.from("room_messages").select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar").eq("room_id", roomId).order("created_at", { ascending: true }).limit(50).then(({ data }) => {
      if (active && data) setRoomMessages(data as RoomChatMessage[]);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [roomMessages]);

  const sendRoomMessage = async () => {
    const value = draft.trim();
    if (!value || sending || !roomSettings.chat_enabled) return;
    setSending(true);
    setDraft("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setDraft(value);
      setSending(false);
      return;
    }
    const localId = `local-${crypto.randomUUID()}`;
    setRoomMessages(prev => [...prev, { id: localId, user_id: user.id, kind: "text", text: value, created_at: new Date().toISOString(), pending: true }].slice(-50));
    const { data, error } = await supabase
      .from("room_messages")
      .insert({ room_id: roomId, user_id: user.id, kind: "text", text: value, client_id: crypto.randomUUID() })
      .select("id, user_id, kind, text, message, created_at, sender_username, sender_avatar")
      .single();
    if (error) {
      setRoomMessages(prev => prev.map(m => m.id === localId ? { ...m, pending: false, failed: true } : m));
      setDraft(value);
    } else if (data) {
      setRoomMessages(prev => [...prev.filter(m => m.id !== localId), data as RoomChatMessage].slice(-50));
    }
    setSending(false);
  };

  useEffect(() => {
    let cancelled = false;
    void supabase.from("profiles").select("theme_id").eq("id", room.host.id).maybeSingle().then(async ({ data }) => {
      if (cancelled || !data?.theme_id) return;
      const { data: theme } = await supabase.from("themes").select("bg_image,animation_url,preview_url,primary_color,accent_color").eq("id", data.theme_id).maybeSingle();
      if (!cancelled) setHostTheme(theme as HostTheme | null);
    });
    return () => {
      cancelled = true;
    };
  }, [room.host.id]);

  const tap = (h: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    h();
  };
  const buttonClass = "touch-manipulation pointer-events-auto select-none active:scale-95 transition-transform";

  const receivers = useMemo<GiftReceiver[]>(() => {
    const list: GiftReceiver[] = [];
    if (room.host?.id) list.push({ id: room.host.id, username: room.host.username ?? "Host", avatar: room.host.avatar ?? null });
    for (const seat of room.seats) {
      if (!seat.user?.id || seat.user.id === room.host.id) continue;
      list.push({ id: seat.user.id, username: seat.user.username, avatar: seat.user.avatar });
    }
    const seen = new Set<string>();
    return list.filter(u => !seen.has(u.id) && seen.add(u.id));
  }, [room.host, room.seats]);

  const openGifts = () => { if (!roomSettings.gifts_enabled) return; setGiftOpen(true); onOpenGift(); };
  const openAnimatedEmojis = (e?: React.SyntheticEvent) => { e?.preventDefault(); e?.stopPropagation(); setEmojiOpen(true); };
  const openGamesModal = (e?: React.SyntheticEvent) => { 
    e?.preventDefault(); 
    e?.stopPropagation(); 
    setGamesOpen(true); 
    onOpenGames?.(); 
  };
  const openPopularity = () => { setPopularityOpen(true); };
  const openMoreForRole = () => { if (isHost) setHostSettingsOpen(true); else if (isModerator) setModeratorControlsOpen(true); else onOpenMore(); };
  
  const joinSeat = (index: number) => { 
    if (roomSettings.is_locked && !isHost && !isUnlockedByPin) {
      setShowPinModal(true);
      return;
    } 
    onJoinSeat(index); 
  };

  const hostMedia = hostTheme?.bg_image || hostTheme?.animation_url || hostTheme?.preview_url;
  const visibleMessages = roomMessages.filter(m => m.kind !== "emoji");
  const openMemberProfile = (seatIndex: number) => {
    const seat = room.seats.find(s => s.index === seatIndex);
    if (!seat?.user) return;
    setSelectedMember({ id: seat.user.id, username: seat.user.username, avatar: seat.user.avatar, level: seat.user.level, gift_score: seat.user.gift_score, is_muted: seat.user.is_muted });
  };

  const currentSlide = gameSlides[currentSlideIndex] || gameSlides[0];

  const handlePickEmoji = (emoji: ChatEmoji) => {
    const targetSeat = selectedTargetSeat;
    const senderSeat = mySeatIndex ?? 0;

    onSendEmoji?.(emoji, targetSeat);
    setEmojiOpen(false);

    if (targetSeat !== null && targetSeat !== undefined) {
      setActiveFlyingEmoji({ emojiUrl: emoji.url || "", fromSeat: senderSeat, toSeat: targetSeat });
      setGlowingSeatIndex(targetSeat);

      setTimeout(() => {
        setActiveFlyingEmoji(null);
      }, 1500);

      setTimeout(() => {
        setGlowingSeatIndex(null);
      }, 3000);
    }
  };

  return (
    <main className="fixed inset-0 z-50 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden bg-slate-950 text-foreground shadow-2xl h-[100svh]">
      {hostMedia ? <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden"><img src={hostMedia} alt="" draggable={false} className="h-full w-full object-cover opacity-90" /></div> : null}
      
      {showPinModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md px-4 animate-fade-in">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900 border border-amber-500/50 p-6 shadow-[0_0_35px_rgba(234,179,8,0.3)] text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center mb-4 text-amber-400">
              <Lock className="h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-lg font-black text-amber-300">Room is Locked! 🔒</h3>
            <p className="mt-1 text-xs text-slate-300">Yeh room lock hai. Enter karne ke liye Host ka diya hua code enter karein:</p>
            
            <input 
              type="password" 
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="Enter Room PIN..."
              className="mt-4 w-full px-4 py-3 rounded-xl bg-black/60 border border-white/20 text-center text-white tracking-widest font-bold text-lg outline-none focus:border-amber-400"
            />

            <div className="mt-6 flex gap-3 w-full">
              <button 
                type="button"
                onClick={() => {
                  if (enteredPin.trim() === roomSettings.room_pin) {
                    setIsUnlockedByPin(true);
                    setShowPinModal(false);
                  } else {
                    alert("Incorrect Room PIN! Please try again.");
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform"
              >
                Enter Room ✨
              </button>
              <button 
                type="button"
                onClick={onExit}
                className="px-4 py-3 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs active:scale-95 transition-transform"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {generatedPin && isHost && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-md px-4 animate-fade-in">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900 border border-purple-500/50 p-6 shadow-[0_0_35px_rgba(168,85,247,0.4)] text-center">
            <div className="h-14 w-14 rounded-full bg-purple-500/20 border border-purple-400 flex items-center justify-center mb-3 text-purple-300">
              <KeyRound className="h-7 w-7" />
            </div>
            <h3 className="text-base font-black text-purple-300">New Room Code Generated!</h3>
            <p className="mt-1 text-xs text-slate-300">Aapka room lock ho chuka hai. Naya Secret Code yeh hai:</p>
            
            <div className="my-4 px-6 py-2 rounded-xl bg-black/80 border border-amber-400/60 text-amber-300 font-black text-2xl tracking-widest shadow-inner">
              {generatedPin}
            </div>

            <button 
              type="button"
              onClick={() => setGeneratedPin(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform"
            >
              Okay, Got It 👍
            </button>
          </div>
        </div>
      )}

      {showHostFreePopup && isHost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in px-4">
          <div className="relative flex flex-col items-center max-w-sm w-full rounded-3xl bg-slate-900 border border-amber-500/50 p-6 shadow-[0_0_35px_rgba(234,179,8,0.4)] text-center">
            <div className="absolute -top-10 animate-bounce">
              <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-amber-400 to-purple-600 p-1 shadow-xl">
                <div className="h-full w-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                  <img src="/images/jalwa-1.gif" alt="Rocket GIF" className="h-14 w-14 object-contain" />
                </div>
              </div>
            </div>
            
            <h3 className="mt-8 text-lg font-black text-amber-300">Room Popularity 100% Reached!</h3>
            <p className="mt-2 text-xs text-slate-300">Host! Aapka Jalwa Rocket trigger ho chuka hai. Free (0 Coins) mein play karein!</p>
            
            <div className="mt-6 flex gap-3 w-full">
              <button 
                type="button"
                onClick={() => {
                  setShowHostFreePopup(false);
                  setShowRocketAnimation(true);
                  setTimeout(() => setShowRocketAnimation(false), 5000);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform"
              >
                Play Free (0 Coins) 🚀
              </button>
              <button 
                type="button"
                onClick={() => setShowHostFreePopup(false)}
                className="px-4 py-3 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs active:scale-95 transition-transform"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRocketAnimation && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center">
            <div className="relative animate-bounce">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400 opacity-90 blur-2xl animate-pulse" />
              <div className="relative grid h-52 w-52 place-items-center p-2">
                <img 
                  src="/images/jalwa-1.gif" 
                  alt="Jalwa Rocket GIF" 
                  className="h-full w-full object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.9)] animate-pulse" 
                />
              </div>
            </div>
            <h2 className="mt-6 text-xl font-black tracking-wider text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">🚀 JALWA ROCKET LAUNCHED! 100% POPULAR! 🚀</h2>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        
        <div className="shrink-0 pt-2 px-3">
          <RoomHeader room={room} roomCode={roomCode} onlineCount={onlineCount} topGifterName={topGifterName} topGifterCoins={topGifterCoins} onHostTap={onHostTap} onReport={onReport} onShare={onShare} onExit={onExit} onHome={onHome} onRanking={onRanking} />
        </div>

        <GiftAnimationPlayer roomId={roomId} />
        
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden justify-between">
          
          <div className="relative flex-1 min-h-0 overflow-y-auto bg-transparent pt-1 px-1 no-scrollbar">
            <SeatGrid 
              seats={room.seats.map(s => ({
                ...s,
                className: s.index === glowingSeatIndex ? "ring-4 ring-amber-400 shadow-[0_0_25px_rgba(234,179,8,0.9)] scale-105 transition-all duration-300" : ""
              }))} 
              seatCount={effectiveSeatCount} 
              host={room.host} 
              roomId={roomId} 
              isHost={isHost} 
              onSeatTap={openMemberProfile} 
              onJoinSeat={joinSeat} 
              onHostTap={onHostTap} 
            />
          </div>

          {activeFlyingEmoji && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-ping absolute h-16 w-16 rounded-full bg-amber-400 opacity-75" />
              <img src={activeFlyingEmoji.emojiUrl} alt="" className="h-16 w-16 object-contain animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,1)]" />
            </div>
          )}

          <div className="shrink-0 flex flex-col gap-[10px] px-3 pb-1">

            <section className="grid grid-cols-[minmax(0,1.7fr)_minmax(85px,.7fr)] gap-1.5">
              
              <div className="flex min-w-0 h-[250px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-black/50 backdrop-blur-xl shadow-xl">
                <div className="flex h-5 shrink-0 items-end gap-3 border-b border-white/10 px-2.5">
                  <button type="button" onClick={tap(onOpenChat)} disabled={!roomSettings.chat_enabled} className={cn(buttonClass,"relative pb-0.5 text-[10px] font-bold text-white disabled:opacity-40")}>All<span className="absolute bottom-0 left-0 h-0.5 w-4 rounded-full bg-amber-400" /></button>
                  <button type="button" onClick={tap(onOpenChat)} disabled={!roomSettings.chat_enabled} className={cn(buttonClass,"pb-0.5 text-[10px] font-medium text-white/60 disabled:opacity-40")}>Chat</button>
                </div>
                
                <div ref={chatContainerRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-0.5 no-scrollbar scroll-smooth">
                  {visibleMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-white/40">
                      <p className="text-[10px] font-medium">{announcement || "Welcome to the room!"}</p>
                    </div>
                  ) : (
                    visibleMessages.map(m => {
                      const avatar = m.user?.avatar || m.sender_avatar;
                      const fallback = (m.user?.username || m.sender_username || "U").trim().charAt(0).toUpperCase();
                      return (
                        <div key={m.id} className="mb-0.5 flex min-w-0 items-start gap-1 text-[10px]">
                          <div className="grid h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full bg-amber-500/20 text-[7px] font-bold text-amber-300 place-items-center border border-amber-500/30">
                            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} /> : fallback}
                          </div>
                          <span className="min-w-0 break-words text-white/90">{m.text || m.message || ""}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={e => { e.preventDefault(); void sendRoomMessage(); }} className={cn("mx-1.5 mb-1 flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 shadow-inner", !roomSettings.chat_enabled && "opacity-50")}>
                  <input 
                    value={draft} 
                    onChange={e => setDraft(e.target.value.slice(0, 500))} 
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void sendRoomMessage(); } }} 
                    placeholder={roomSettings.chat_enabled ? "Say something..." : "Chat disabled"} 
                    disabled={sending || !roomSettings.chat_enabled} 
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-form-type="other"
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-medium text-white outline-none placeholder:text-white/40" 
                  />
                  <button type="button" onClick={openAnimatedEmojis} disabled={!roomSettings.chat_enabled} className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-amber-300"><Smile className="h-3 w-3" /></button>
                  <button type="submit" disabled={!draft.trim() || sending || !roomSettings.chat_enabled} className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-purple-600 text-black font-bold"><Send className="h-2.5 w-2.5" /></button>
                </form>
              </div>
              
              <div className="flex min-w-0 flex-col justify-between items-end gap-1 h-[250px]">
                <button 
                  type="button" 
                  onClick={tap(openPopularity)} 
                  style={{ height: "100px" }}
                  className={cn(
                    buttonClass,
                    "relative group flex items-center justify-center bg-transparent border-0 p-0 w-full shrink-0 shadow-none"
                  )}
                >
                  <div className="relative h-[100px] w-[100px] flex items-center justify-center">
                    <img src="/images/jalwa-1.gif" alt="Rocket GIF" className="h-[100px] w-[100px] object-contain animate-bounce drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                  </div>
                </button>

                <div 
                  style={{ height: "150px" }}
                  className="relative w-full shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black/50 backdrop-blur-md flex items-center justify-center shadow-lg"
                >
                  {currentSlide && (
                    <img src={currentSlide.image_url} alt={currentSlide.title} className="h-full w-full object-cover rounded-xl" />
                  )}
                </div>
              </div>

            </section>
          </div>

        </div>
      </div>
      
      <nav style={{ backgroundColor: "rgba(10, 10, 15, 0.95)" }} className="relative z-20 flex h-[52px] shrink-0 items-center justify-around border-t border-white/15 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <button type="button" onClick={tap(onToggleMic)} disabled={!isHost && !roomSettings.guest_mic_enabled} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white disabled:opacity-40")} aria-label={micOn ? "Mute microphone" : "Unmute microphone"}>
          {micOn ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-rose-400" />}
        </button>
        <button type="button" onClick={openAnimatedEmojis} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label="Animated Emojis" aria-expanded={emojiOpen}>
          <Smile className="h-3.5 w-3.5 text-amber-300" />
        </button>
        <button type="button" onClick={openGamesModal} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label="Games" aria-expanded={gamesOpen}>
          <Gamepad2 className="h-3.5 w-3.5 text-purple-400" />
        </button>
        <button type="button" onClick={tap(onOpenPrivateChat)} className={cn(buttonClass,"grid h-9 w-9 place-items-center rounded-full border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-md")} aria-label="Private Chat">
          <MessageCircle className="h-4 w-4" />
        </button>
        <button type="button" onClick={tap(openGifts)} disabled={!roomSettings.gifts_enabled} className={cn(buttonClass, "relative group grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-purple-600 to-indigo-900 p-0.5 shadow-[0_0_15px_rgba(234,179,8,0.5)] border border-white/40 disabled:opacity-40")} aria-label={roomSettings.gifts_enabled ? "Gifts" : "Gifts disabled"}>
          <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="grid h-full w-full place-items-center rounded-[12px] bg-black/60 backdrop-blur-sm text-amber-200">
            <Gift className="h-4.5 w-4.5 animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-amber-300" />
          </div>
        </button>
        <button type="button" onClick={openMoreForRole} className={cn(buttonClass,"grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white")} aria-label={isHost ? "Host Room Settings" : isModerator ? "Moderator Controls" : "More"}>
          {isHost ? <Shield className="h-3.5 w-3.5 text-amber-400" /> : isModerator ? <Shield className="h-3.5 w-3.5 text-cyan-400" /> : <Grid2X2 className="h-3.5 w-3.5 text-white" />}
        </button>
      </nav>

      {giftOpen && <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} roomId={roomId} receivers={receivers} />}
      
      {emojiOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setEmojiOpen(false)} />
          <div className="relative z-10 w-full rounded-t-3xl bg-slate-900/95 border-t border-amber-500/30 p-4 shadow-2xl backdrop-blur-xl animate-slide-up max-h-[60dvh] flex flex-col">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-700" />
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold tracking-wide text-amber-400 uppercase">Send Emoji to Seat</span>
              </div>
              <button type="button" onClick={() => setEmojiOpen(false)} className="text-xs font-semibold text-slate-400 hover:text-white">
                Close
              </button>
            </div>

            <div className="py-2.5 border-b border-slate-800/80">
              <p className="text-[10px] text-slate-400 mb-2 font-medium">Select Target Seat (Optional):</p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTargetSeat(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border",
                    selectedTargetSeat === null 
                      ? "bg-amber-500 text-black border-amber-400 shadow-md" 
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  )}
                >
                  General Chat
                </button>
                {room.seats.map((seat) => (
                  <button
                    key={seat.index}
                    type="button"
                    onClick={() => setSelectedTargetSeat(seat.index)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all border",
                      selectedTargetSeat === seat.index 
                        ? "bg-amber-500 text-black border-amber-400 shadow-md" 
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    )}
                  >
                    <UserCheck className="h-3 w-3" />
                    <span>Seat {seat.index + 1} {seat.user?.username ? `(${seat.user.username})` : "(Empty)"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              <ChatEmojiSheet open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={handlePickEmoji} />
            </div>
          </div>
        </div>
      )}

      {gamesOpen && <RoomGamesSheet open={gamesOpen} onClose={() => setGamesOpen(false)} onOpenNative={(slug) => { setGamesOpen(false); onOpenNativeGame?.(slug); }} />}
      {popularityOpen && <HostPopularitySheet roomId={roomId} open={popularityOpen} onClose={() => setPopularityOpen(false)} popularityPct={popularityPct} hostName={room.host?.username} />}
      {selectedMember && <VoiceRoomMemberSheet member={selectedMember} canModerate={isHost} isHost={isHost} onClose={() => setSelectedMember(null)} />}
      {isHost && <HostRoomSettings roomId={roomId} open={hostSettingsOpen} onClose={() => setHostSettingsOpen(false)} onSettingsChange={setRoomSettings} />}
      {isModerator && <ModeratorControls roomId={roomId} open={moderatorControlsOpen} onClose={() => setModeratorControlsOpen(false)} />}
    </main>
  );
};
