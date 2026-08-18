export type LiveRoomKind = "voice" | "video" | "pk";

export type LiveRoomComponent = {
  id: string;
  type: string;
  label: string;
  source?: string;
  runtimeType?: string;
  editable: string[];
  action?: string;
  children?: LiveRoomComponent[];
  repeatable?: boolean;
};

export const LIVE_ROOM_EDITABLE = [
  "position", "size", "spacing", "visibility", "zIndex", "background", "border", "radius", "shadow", "opacity",
  "responsive", "typography", "content", "icon", "image", "video", "layout", "gap", "aspectRatio", "objectFit",
  "interaction", "animation", "transform", "padding", "margin", "color", "font", "fontSize", "fontWeight", "borderColor",
];
const e = (...extra: string[]) => [...LIVE_ROOM_EDITABLE, ...extra];
const leaf = (id: string, type: string, runtimeType: string, label: string, extra: string[] = []): LiveRoomComponent => ({ id, type, runtimeType, label, editable: e(...extra) });

export const LIVE_ROOM_REGISTRY: Record<LiveRoomKind, LiveRoomComponent> = {
  voice: {
    id: "voice-room", type: "room", label: "Voice Room", source: "src/routes/room.$roomId.tsx", editable: e(),
    children: [
      { id: "voice.header", type: "header", runtimeType: "room-header", label: "Header", editable: e("logo", "roomName", "roomId", "verification", "report", "share", "exit", "settings", "menu"), children: [
        leaf("voice.header.logo", "image", "room-header-logo", "Room Logo", ["image"]), leaf("voice.header.name", "text", "room-header-name", "Room Name", ["content"]), leaf("voice.header.id", "text", "room-header-id", "Room ID", ["content"]), leaf("voice.header.verification", "badge", "room-verification", "Verification"),
        leaf("voice.header.report", "icon-button", "room-report", "Report"), leaf("voice.header.share", "icon-button", "room-share", "Share"), leaf("voice.header.exit", "icon-button", "room-exit", "Exit"), leaf("voice.header.settings", "icon-button", "room-settings", "Room Settings"), leaf("voice.header.more", "icon-button", "room-more", "More"),
      ] },
      { id: "voice.room-info", type: "room-info", runtimeType: "room-info", label: "Room Information", editable: e("ranking", "online", "popularity", "category", "announcement", "event"), children: [
        leaf("voice.ranking", "counter", "room-ranking", "Ranking"), leaf("voice.online", "counter", "online-counter", "Online Users"), leaf("voice.popularity", "counter", "room-popularity", "Popularity"), leaf("voice.category", "chip", "room-category", "Room Category"), leaf("voice.announcement", "banner", "room-announcement", "Announcement", ["animation"]), leaf("voice.events", "banner", "room-event", "Event Information", ["animation"]),
      ] },
      { id: "voice.seat-area", type: "seat-area", runtimeType: "voice-seat-area", label: "Voice Seats", source: "SeatsGrid", editable: e("seatCount", "gap") },
      { id: "voice.seat", type: "seat", runtimeType: "voice-seat", label: "Voice Seat", source: "SeatsGrid", repeatable: true, editable: e("avatar", "frame", "badge", "mic", "speaking", "crown") },
      { id: "voice.host", type: "host-card", runtimeType: "host-card", label: "Host", source: "HostCard", editable: e("avatar", "frame", "badge", "crown", "likeCount", "mic", "speaking") },
      leaf("voice.waveform", "waveform", "waveform", "Audio Waveform", ["animation"]),
      leaf("voice.audio", "audio-controls", "room-audio-controls", "Audio Controls", ["mic", "speaker", "mute", "muteAll"]),
      leaf("voice.activity", "activity", "room-activity", "Activity / Notifications", ["animation"]),
      leaf("voice.chat", "chat", "room-chat", "Chat", ["tabs", "input", "emoji", "send", "messages", "giftNotifications"]),
      leaf("voice.gifts", "gift-sheet", "room-gifts", "Gift Sheet", ["interaction", "animation"]),
      leaf("voice.seat-actions", "bottom-sheet", "bottom-sheet", "Seat Action Sheet", ["interaction", "animation"]),
      { id: "voice.bottom-nav", type: "navigation", runtimeType: "bottom-navigation", label: "Bottom Navigation", editable: e("icon", "interaction"), children: ["home", "gifts", "game", "mic", "chat", "more"].map((x) => leaf(`voice.nav.${x}`, "icon-button", `nav-${x}`, x[0].toUpperCase() + x.slice(1))) },
    ],
  },
  video: {
    id: "video-room", type: "room", label: "Video Room", source: "src/routes/room.$roomId.tsx", editable: e(),
    children: [
      leaf("video.header", "header", "room-header", "Header", ["logo", "roomName", "roomId", "verification", "report", "share", "exit", "menu"]),
      leaf("video.room-info", "room-info", "room-info", "Room Information"),
      leaf("video.stage", "video-stage", "video-grid", "Video Stage", ["fullscreen", "spotlight"]),
      { id: "video.participant", type: "video-tile", runtimeType: "video-tile", repeatable: true, label: "Participant Video", editable: e("layout", "aspectRatio", "objectFit", "avatar", "mic", "camera", "speaking", "activeSpeaker", "name", "badge", "frame") },
      leaf("video.active-speaker", "active-speaker", "active-speaker", "Active Speaker", ["animation"]),
      leaf("video.controls", "video-controls", "room-controls", "Video Controls", ["camera", "mic", "speaker", "flipCamera", "mute", "muteAll", "endLive", "invite", "gift", "chat", "menu"]),
      leaf("video.chat", "chat", "room-chat", "Chat", ["tabs", "input", "emoji", "send"]),
      leaf("video.gifts", "gift-sheet", "room-gifts", "Gift Sheet", ["interaction", "animation"]),
      leaf("video.activity", "activity", "room-activity", "Activity", ["animation"]),
      leaf("video.bottom", "navigation", "bottom-navigation", "Bottom Controls", ["icon", "interaction"]),
    ],
  },
  pk: {
    id: "pk-battle", type: "room", label: "PK Battle", source: "src/routes/pk.$roomId.tsx", editable: e(),
    children: [
      leaf("pk.header", "header", "room-header", "Header"),
      leaf("pk.team-a", "pk-team", "pk-team-a", "Team A", ["avatar", "video", "name", "level", "badge", "score", "gifts", "likes", "status"]),
      leaf("pk.team-a.video", "video-tile", "pk-team-a-video", "Team A Video", ["objectFit", "frame"]), leaf("pk.team-a.avatar", "avatar", "pk-team-a-avatar", "Team A Avatar", ["image", "frame"]), leaf("pk.team-a.score", "counter", "pk-team-a-score", "Team A Score"),
      leaf("pk.team-b", "pk-team", "pk-team-b", "Team B", ["avatar", "video", "name", "level", "badge", "score", "gifts", "likes", "status"]),
      leaf("pk.team-b.video", "video-tile", "pk-team-b-video", "Team B Video", ["objectFit", "frame"]), leaf("pk.team-b.avatar", "avatar", "pk-team-b-avatar", "Team B Avatar", ["image", "frame"]), leaf("pk.team-b.score", "counter", "pk-team-b-score", "Team B Score"),
      leaf("pk.vs", "pk-vs", "pk-vs", "VS Graphic", ["animation"]), leaf("pk.timer", "pk-timer", "pk-timer", "Battle Timer", ["animation"]), leaf("pk.score", "pk-score", "pk-score", "PK Score", ["progress"]), leaf("pk.progress", "progress", "pk-progress", "Battle Progress", ["animation"]),
      leaf("pk.gifts", "gift-effects", "gift-notifications", "Gift Effects", ["animation"]), leaf("pk.chat", "chat", "room-chat", "Chat", ["input", "messages"]), leaf("pk.controls", "navigation", "pk-controls", "Controls"), leaf("pk.winner", "winner-overlay", "winner-overlay", "Winner Overlay", ["animation", "avatar", "badge", "button"]),
    ],
  },
};

export function getLiveRoomRegistry(kind: LiveRoomKind) { return LIVE_ROOM_REGISTRY[kind]; }
export function flattenLiveRoomRegistry(kind: LiveRoomKind) { const result: LiveRoomComponent[] = []; const walk = (node: LiveRoomComponent) => { result.push(node); node.children?.forEach(walk); }; walk(LIVE_ROOM_REGISTRY[kind]); return result; }
