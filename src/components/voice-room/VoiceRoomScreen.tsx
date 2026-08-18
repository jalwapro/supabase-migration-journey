import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { RoomHeader, AnnouncementTicker } from "./RoomHeader";
import { HostCard } from "./HostCard";
import { SeatsGrid } from "./SeatsGrid";
import { VoiceControls } from "./VoiceControls";
import { ChatPanel } from "./ChatPanel";
import { SidePanels, BottomNav } from "./RoomExtras";
import { VoiceRoomGiftSheet } from "./VoiceRoomGiftSheet";
import { SeatActionSheet } from "./ActionSheet";
import {
  MOCK_HOST,
  MOCK_ANNOUNCEMENTS,
  MOCK_MESSAGES,
  MOCK_EVENT_BANNERS,
  buildMockSeats,
  type RoomSeat,
  type ChatMessage,
  type AnnouncementItem,
  type GiftItem,
} from "./types";

const ME_ID = "me";

/**
 * Premium neon Voice Room screen. Self-contained with mock data + local
 * state so it can be dropped in anywhere for review; swap the state/handlers
 * below for real Supabase/Zego wiring (see room.$roomId.tsx) when ready.
 */
export function VoiceRoomScreen() {
  const [seats, setSeats] = useState<RoomSeat[]>(() => buildMockSeats());
  const [host] = useState(MOCK_HOST);
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(MOCK_ANNOUNCEMENTS);
  const [roomAnnouncement, setRoomAnnouncement] = useState("Be kind, have fun, and enjoy the room! 💜");
  const [popularityPct] = useState(62);

  const [giftOpen, setGiftOpen] = useState(false);
  const [giftReceiver, setGiftReceiver] = useState<string>(host.name);
  const [seatSheetOpen, setSeatSheetOpen] = useState(false);
  const [activeSeat, setActiveSeat] = useState<RoomSeat | null>(null);

  const mySeat = useMemo(() => seats.find((s) => s.user?.id === ME_ID) ?? null, [seats]);

  const pushAnnouncement = useCallback((text: string, kind: AnnouncementItem["kind"] = "system") => {
    setAnnouncements((prev) => [{ id: `${Date.now()}`, kind, text }, ...prev].slice(0, 12));
  }, []);

  const pushMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const handleSeatTap = useCallback((seat: RoomSeat) => {
    setActiveSeat(seat);
    setSeatSheetOpen(true);
  }, []);

  const handleJoinSeat = useCallback(() => {
    if (!activeSeat) return;
    if (mySeat) {
      toast.error("Leave your current seat first");
      return;
    }
    setSeats((prev) =>
      prev.map((s) =>
        s.seatNumber === activeSeat.seatNumber
          ? {
              ...s,
              user: {
                id: ME_ID,
                name: "You",
                avatarUrl: "https://api.dicebear.com/9.x/personas/svg?seed=You&backgroundColor=1a0b2e",
                popularity: 0,
                mic: "on",
                online: true,
              },
            }
          : s,
      ),
    );
    pushAnnouncement(`You joined seat ${activeSeat.seatNumber}`, "enter");
    setSeatSheetOpen(false);
  }, [activeSeat, mySeat, pushAnnouncement]);

  const handleLeaveSeat = useCallback(() => {
    if (!activeSeat) return;
    setSeats((prev) => prev.map((s) => (s.seatNumber === activeSeat.seatNumber ? { ...s, user: null } : s)));
    pushAnnouncement(`You left seat ${activeSeat.seatNumber}`, "leave");
    setSeatSheetOpen(false);
  }, [activeSeat, pushAnnouncement]);

  const handleToggleSeatMic = useCallback(() => {
    if (!activeSeat?.user) return;
    setSeats((prev) =>
      prev.map((s) =>
        s.seatNumber === activeSeat.seatNumber && s.user
          ? { ...s, user: { ...s.user, mic: s.user.mic === "on" ? "off" : "on" } }
          : s,
      ),
    );
  }, [activeSeat]);

  const handleFollow = useCallback(() => {
    toast.success(`Following ${activeSeat?.user?.name ?? "user"}`);
    setSeatSheetOpen(false);
  }, [activeSeat]);

  const handleOpenProfile = useCallback(() => {
    toast(`Opening ${activeSeat?.user?.name ?? "user"}'s profile…`);
    setSeatSheetOpen(false);
  }, [activeSeat]);

  const handleSendGift = useCallback(
    (gift: GiftItem) => {
      pushAnnouncement(`You sent ${gift.name} x1 to ${giftReceiver}`, "gift");
      pushMessage({ kind: "gift", userName: "You", body: `sent a gift to ${giftReceiver}`, giftName: gift.name, giftIcon: gift.icon });
      toast.success(`Sent ${gift.icon} ${gift.name} to ${giftReceiver}!`);
      setGiftOpen(false);
    },
    [giftReceiver, pushAnnouncement, pushMessage],
  );

  const openGiftsFor = useCallback((receiver: string) => {
    setGiftReceiver(receiver);
    setGiftOpen(true);
  }, []);

  const handleSendMessage = useCallback(
    (text: string) => {
      pushMessage({ kind: "user", userName: "You", userColor: "text-fuchsia-300", body: text });
    },
    [pushMessage],
  );

  return (
    <div
      data-adaptive="neon"
      data-live-component="voice.room"
      data-live-component-instance="0"
      className="relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[#08050c] text-white"
      style={{
        backgroundImage:
          "radial-gradient(60% 40% at 50% 0%, rgba(139,92,246,0.18), transparent), radial-gradient(50% 30% at 100% 30%, rgba(232,60,220,0.12), transparent)",
      }}
    >
      <div data-live-component="voice.header" data-live-component-instance="0">
        <RoomHeader
          roomName="Love Is Life"
          roomId="10069110"
          onlineCount={128}
          onReport={() => toast("Report submitted")}
          onShare={() => toast("Share link copied")}
          onExit={() => toast("Exiting room…")}
          onRanking={() => toast("Opening ranking…")}
          onOnline={() => toast("128 users online")}
          onHome={() => toast("Home")}
        />
      </div>

      <div className="mt-2 flex w-full min-w-0 flex-1 flex-col gap-3 px-2.5 pb-4 sm:px-3 lg:flex-row lg:items-start" data-live-component="voice.content" data-live-component-instance="0">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div data-live-component="voice.seat-area" data-live-component-instance="0">
            <SeatsGrid seats={seats} onSeatTap={handleSeatTap} center={<div data-live-component="voice.host" data-live-component-instance="0"><HostCard host={host} onTap={() => openGiftsFor(host.name)} /></div>} />
          </div>

          <div data-live-component="voice.controls" data-live-component-instance="0">
            <VoiceControls
              micOn={micOn}
              speakerOn={speakerOn}
              onToggleMic={() => setMicOn((v) => !v)}
              onToggleSpeaker={() => setSpeakerOn((v) => !v)}
              onMuteAll={() => toast("All seats muted")}
            />
          </div>

          <div data-live-component="voice.announcement" data-live-component-instance="0">
            <AnnouncementTicker items={announcements} />
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:hidden">
            <div data-live-component="voice.chat" data-live-component-instance="0"><ChatPanel messages={messages} onSend={handleSendMessage} /></div>
            <div data-live-component="voice.side-panels" data-live-component-instance="0"><SidePanels popularityPct={popularityPct} announcement={roomAnnouncement} banners={MOCK_EVENT_BANNERS} /></div>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div data-live-component="voice.chat" data-live-component-instance="0"><ChatPanel messages={messages} onSend={handleSendMessage} /></div>
          </div>
        </div>

        <div className="hidden w-72 min-w-0 shrink-0 lg:block">
          <div data-live-component="voice.side-panels" data-live-component-instance="0"><SidePanels popularityPct={popularityPct} announcement={roomAnnouncement} banners={MOCK_EVENT_BANNERS} /></div>
        </div>
      </div>

      <div data-live-component="voice.bottom-nav" data-live-component-instance="0">
        <BottomNav
          micOn={micOn}
          onHome={() => toast("Home")}
          onGifts={() => openGiftsFor(host.name)}
          onGame={() => toast("Opening games…")}
          onMic={() => setMicOn((v) => !v)}
          onChat={() => toast("Chat focused")}
          onProfile={() => toast("Opening profile…")}
        />
      </div>

      <VoiceRoomGiftSheet
        open={giftOpen}
        onOpenChange={setGiftOpen}
        receiverName={giftReceiver}
        onSendGift={handleSendGift}
      />

      <SeatActionSheet
        open={seatSheetOpen}
        onOpenChange={setSeatSheetOpen}
        seatNumber={activeSeat?.seatNumber ?? null}
        user={activeSeat?.user ?? null}
        isMe={activeSeat?.user?.id === ME_ID}
        onJoin={handleJoinSeat}
        onLeave={handleLeaveSeat}
        onToggleMic={handleToggleSeatMic}
        onFollow={handleFollow}
        onOpenProfile={handleOpenProfile}
      />
    </div>
  );
}
