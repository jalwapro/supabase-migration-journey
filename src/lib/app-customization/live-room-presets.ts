import type { LiveRoomKind } from "./live-room-registry";

export type LiveRoomPreset = {
  id: string;
  label: string;
  room: LiveRoomKind;
  repeatable?: { componentId: string; count: number };
};

export const LIVE_ROOM_PRESETS: LiveRoomPreset[] = [
  { id: "voice-4", label: "4 Seat", room: "voice", repeatable: { componentId: "voice.seat", count: 4 } },
  { id: "voice-8", label: "8 Seat", room: "voice", repeatable: { componentId: "voice.seat", count: 8 } },
  { id: "voice-12", label: "12 Seat", room: "voice", repeatable: { componentId: "voice.seat", count: 12 } },
  { id: "voice-16", label: "16 Seat", room: "voice", repeatable: { componentId: "voice.seat", count: 16 } },
  { id: "voice-20", label: "20 Seat", room: "voice", repeatable: { componentId: "voice.seat", count: 20 } },
  { id: "video-fullscreen", label: "Fullscreen", room: "video" },
  { id: "video-2", label: "2 Person", room: "video", repeatable: { componentId: "video.participant", count: 2 } },
  { id: "video-4", label: "4 Grid", room: "video", repeatable: { componentId: "video.participant", count: 4 } },
  { id: "video-6", label: "6 Grid", room: "video", repeatable: { componentId: "video.participant", count: 6 } },
  { id: "video-9", label: "9 Grid", room: "video", repeatable: { componentId: "video.participant", count: 9 } },
  { id: "video-spotlight", label: "Spotlight", room: "video", repeatable: { componentId: "video.participant", count: 2 } },
  { id: "pk-standard", label: "Standard PK", room: "pk" },
  { id: "pk-fullscreen", label: "Fullscreen PK", room: "pk" },
  { id: "pk-split", label: "Split Screen", room: "pk" },
  { id: "pk-compact", label: "Compact PK", room: "pk" },
  { id: "pk-custom", label: "Custom", room: "pk" },
];

export function presetsForRoom(room: LiveRoomKind) {
  return LIVE_ROOM_PRESETS.filter((preset) => preset.room === room);
}
