import { createFileRoute } from "@tanstack/react-router";
import { VoiceRoomScreen } from "@/components/voice-room/VoiceRoomScreen";

export const Route = createFileRoute("/voice-room-redesign")({ component: VoiceRoomScreen });
