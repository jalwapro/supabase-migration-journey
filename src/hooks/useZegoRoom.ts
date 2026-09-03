// Compatibility facade during the ZEGOCLOUD -> self-hosted LiveKit migration.
// Existing Voice Room consumers keep their current import path and public hook
// contract while the actual RTC implementation is now LiveKit.
export {
  useLiveKitRoom as useZegoRoom,
  type RemoteUser,
  type RemoteAudioTrack,
  type RemoteVideoTrack,
  type UseLiveKitRoomArgs as UseZegoRoomArgs,
} from "@/hooks/useLiveKitRoom";
