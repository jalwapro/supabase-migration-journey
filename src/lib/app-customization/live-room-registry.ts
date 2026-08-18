export type LiveRoomKind = "voice" | "video" | "pk";

export type LiveRoomComponent = {
  id: string;
  type: string;
  label: string;
  source?: string;
  editable: string[];
  action?: string;
  children?: LiveRoomComponent[];
};

const commonEditable = ["position", "size", "spacing", "visibility", "zIndex", "background", "border", "radius", "shadow", "opacity", "responsive"];

export const LIVE_ROOM_REGISTRY: Record<LiveRoomKind, LiveRoomComponent> = {
  voice: {
    id: "voice-room",
    type: "room",
    label: "Voice Room",
    source: "src/routes/room.$roomId.tsx",
    editable: commonEditable,
    children: [
      { id: "voice.header", type: "header", label: "Room Header", source: "RoomHeader", editable: [...commonEditable, "typography", "content", "icon"] },
      { id: "voice.room-info", type: "room-info", label: "Room Information", editable: [...commonEditable, "typography", "content"] },
      { id: "voice.seat-area", type: "seat-area", label: "Voice Seats", source: "SeatsGrid", editable: [...commonEditable, "layout", "seatCount", "gap"] },
      { id: "voice.host", type: "host-card", label: "Host", source: "HostCard", editable: [...commonEditable, "typography", "avatar", "frame", "badge"] },
      { id: "voice.controls", type: "voice-controls", label: "Voice Controls", source: "VoiceControls", editable: [...commonEditable, "icon", "content", "interaction"] },
      { id: "voice.activity", type: "activity", label: "Activity / Announcements", source: "AnnouncementTicker", editable: [...commonEditable, "typography", "content"] },
      { id: "voice.chat", type: "chat", label: "Chat", source: "ChatPanel", editable: [...commonEditable, "typography", "content", "input"] },
      { id: "voice.gifts", type: "gift-sheet", label: "Gift Sheet", source: "GiftSheet", editable: [...commonEditable, "typography", "content", "interaction"] },
      { id: "voice.seat-actions", type: "bottom-sheet", label: "Seat Action Sheet", source: "SeatActionSheet", editable: [...commonEditable, "typography", "content", "animation"] },
      { id: "voice.bottom-nav", type: "navigation", label: "Bottom Navigation", source: "BottomNav", editable: [...commonEditable, "typography", "icon", "content", "interaction"] },
    ],
  },
  video: {
    id: "video-room",
    type: "room",
    label: "Video Room",
    source: "src/routes/room.$roomId.tsx",
    editable: commonEditable,
    children: [
      { id: "video.header", type: "header", label: "Room Header", editable: [...commonEditable, "typography", "content", "icon"] },
      { id: "video.stage", type: "video-stage", label: "Video Stage", source: "useZegoRoom", editable: [...commonEditable, "layout", "gap", "aspectRatio"] },
      { id: "video.participants", type: "video-grid", label: "Participant Videos", editable: [...commonEditable, "layout", "gap", "aspectRatio"] },
      { id: "video.controls", type: "video-controls", label: "Video Controls", editable: [...commonEditable, "icon", "interaction"] },
      { id: "video.chat", type: "chat", label: "Chat", editable: [...commonEditable, "typography", "input"] },
      { id: "video.gifts", type: "gift-sheet", label: "Gift Sheet", editable: [...commonEditable, "content", "interaction"] },
    ],
  },
  pk: {
    id: "pk-battle",
    type: "room",
    label: "PK Battle",
    source: "src/routes/pk.$roomId.tsx",
    editable: commonEditable,
    children: [
      { id: "pk.header", type: "header", label: "PK Header", editable: [...commonEditable, "typography", "content", "icon"] },
      { id: "pk.team-a", type: "pk-team", label: "Team A", editable: [...commonEditable, "layout", "avatar", "frame", "badge", "typography"] },
      { id: "pk.team-b", type: "pk-team", label: "Team B", editable: [...commonEditable, "layout", "avatar", "frame", "badge", "typography"] },
      { id: "pk.vs", type: "pk-vs", label: "VS Graphic", editable: [...commonEditable, "content", "animation"] },
      { id: "pk.timer", type: "pk-timer", label: "Battle Timer", editable: [...commonEditable, "typography", "content", "animation"] },
      { id: "pk.score", type: "pk-score", label: "PK Score", editable: [...commonEditable, "typography", "content", "progress"] },
      { id: "pk.progress", type: "progress", label: "Battle Progress", editable: [...commonEditable, "progress", "animation"] },
      { id: "pk.gifts", type: "gift-effects", label: "Gift Effects", source: "GiftAnimationPlayer", editable: [...commonEditable, "animation", "opacity"] },
      { id: "pk.chat", type: "chat", label: "Chat", editable: [...commonEditable, "typography", "input"] },
      { id: "pk.winner", type: "winner-overlay", label: "Winner Overlay", editable: [...commonEditable, "typography", "content", "animation"] },
    ],
  },
};

export function getLiveRoomRegistry(kind: LiveRoomKind) {
  return LIVE_ROOM_REGISTRY[kind];
}

export function flattenLiveRoomRegistry(kind: LiveRoomKind) {
  const root = LIVE_ROOM_REGISTRY[kind];
  return [root, ...(root.children ?? [])];
}
