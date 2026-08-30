import { useEffect, useMemo, useState } from "react";
import { Gift, Gamepad2, Smile, Send, Grid2X2, Mic, MicOff, Volume2, VolumeX, Shield, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { ChatEmojiSheet, type ChatEmoji } from "@/components/chat/ChatEmojiSheet";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
// Removed RoomGamesSheet as we are using a slider now
import { GiftAnimationPlayer } from "@/components/room/GiftAnimationPlayer";
import { VoiceRoomMemberSheet, type VoiceRoomMemberProfile } from "./VoiceRoomMemberSheet";
import { ModeratorControls } from "./ModeratorControls";
import { HostRoomSettings } from "./HostRoomSettings";
import { HostPopularitySheet } from "./HostPopularitySheet";

const MIN_CAPACITY = 4, MAX_CAPACITY = 20;
const normalizeCapacity = (v: unknown) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(v)) || MAX_CAPACITY));

type HostTheme = { bg_image: string | null; animation_url: string | null; preview_url: string | null; primary_color: string | null; accent_color: string | null };
type RoomChatMessage = { id: string; user_id: string | null; text: string | null; message?: string | null; kind: string; created_at: string; sender_username?: string | null; sender_avatar?: string | null; user?: { username: string | null; avatar: string | null } | null; pending?: boolean; failed?: boolean };
type RoomSettings = { is_locked: boolean; chat_enabled: boolean; gifts_enabled: boolean; guest_mic_enabled: boolean };

// Game Slider Data Interface
interface GameSlide {
  id: number;
  imageUrl: string;
  title: string;
  linkUrl?: string;
}

// Mock Game Slides Data (Replace with API data)
const GAME_SLIDES: GameSlide[] = [
  { id: 1, imageUrl: "/images/games/ludo-banner.jpg", title: "Ludo Star" },
  { id: 2, imageUrl: "/images/games/teenpatti-banner.jpg", title: "Teen Patti" },
  { id: 3, imageUrl: "/images/games/rummy-banner.jpg", title: "Rummy Gold" },
  { id: 4, imageUrl: "/images/games/pokerdhamaal-banner.jpg", title: "Poker Dhamaal" },
];

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
  onSendEmoji?: (emoji: ChatEmoji) => void;
  canPlayMusic?: boolean;
  onSeatTap: (i: number) => void;
  onJoinSeat: (i: number) => void;
  onHostTap?: () => void;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onHome: () => void;
  onRanking: () => void;
  // onOpenGames is replaced by slider interaction
}

const DEFAULT_ROOM_SETTINGS: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true };

export const VoiceRoomScreen = ({
  room,
  roomId,
  seatCount,
  roomCode,
  onlineCount,
  micOn,
  speakerMuted,
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
  onToggleSpeaker,
  onOpenMusic,
  onSendEmoji,
  onSeatTap,
  onJoinSeat,
  onHostTap,
  onReport,
  onShare,
  onExit,
  onHome,
  onRanking,
}: VoiceRoomScreenProps) => {
  const [giftOpen, setGiftOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
  
  // NEW: State for Game Image Slider
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const effectiveSeatCount = normalizeCapacity(seatCount ?? liveSeatCount);

  // NEW: Game Slider Auto-play and logic
  useEffect(() => {
      const slideInterval = setInterval(() => {
          setCurrentSlideIndex((prevIndex) => 
              prevIndex === GAME_SLIDES.length - 1 ? 0 : prevIndex + 1
          );
      }, 5000); // Change slide every 5 seconds
      return () => clearInterval(slideInterval);
  }, []);

  const nextSlide = () => {
      setCurrentSlideIndex((prevIndex) => 
          prevIndex === GAME_SLIDES.length - 1 ? 0 : prevIndex + 1
      );
  };

  const prevSlide = () => {
      setCurrentSlideIndex((prevIndex) => 
          prevIndex === 0 ? GAME_SLIDES.length - 1 : prevIndex - 1
      );
  };


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
    const channel = supabase.channel(`voice-role-${roomId}`).on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => void syncRole()).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId, isHost]);

  useEffect(() => {
    let active = true;
    const syncSettings = async () => {
      const { data, error } = await supabase.from("live_rooms").select("is_locked,chat_enabled,gifts_enabled,guest_mic_enabled").eq("id", roomId).maybeSingle();
      if (active && !error && data) setRoomSettings(prev => ({ ...prev, ...data } as RoomSettings));
    };
    void syncSettings();
    const channel = supabase.channel(`voice-room-settings-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => {
      const row = payload.new as Partial<RoomSettings>;
      if (active) setRoomSettings(prev => ({ ...prev, ...row }));
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
      if (active) setRoomMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev.filter(m => !(m.pending && m.text === row.text)), row].slice(-50));
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
    const { data, error } = await supabase.from("room_messages").insert({ room_id: roomId, user_id: user.id, kind: "text", text: value, client_id: crypto.randomUUID() }).select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar").single();
    if (error) {
      setRoomMessages(prev => prev.map(m => m.id === localId ? { ...m, pending: false, failed: true } : m));
      setDraft(value);
    } else if (data) {
      setRoomMessages(prev => [...prev.filter(m => m.id !== localId && !(m.pending && m.text === value)), data as RoomChatMessage].slice(-50));
    }
    setSending(false);
  };

  useEffect(() => {
    if (seatCount != null) {
      setLiveSeatCount(normalizeCapacity(seatCount));
      return;
    }
    const channel = supabase.channel(`voice-layout-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, p => {
      const row = p.new as { seat_count?: number };
      if (row.seat_count != null) setLiveSeatCount(normalizeCapacity(row.seat_count));
    }).subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, seatCount]);

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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const p = document.body.style.getPropertyValue("--primary"), s = document.body.style.getPropertyValue("--secondary");
    if (hostTheme?.primary_color) document.body.style.setProperty("--primary", hostTheme.primary_color);
    if (hostTheme?.accent_color) document.body.style.setProperty("--secondary", hostTheme.accent_color);
    return () => {
      if (p) document.body.style.setProperty("--primary", p); else document.body.style.removeProperty("--primary");
      if (s) document.body.style.setProperty("--secondary", s); else document.body.style.removeProperty("--secondary");
    };
  }, [hostTheme]);

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
      if (!seat.user?.
