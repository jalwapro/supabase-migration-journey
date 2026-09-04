// Backward-compatible module name for existing room UI imports.
// The RTC implementation is now entirely LiveKit; no ZEGOCLOUD SDK is used.
export {
  useLiveKitRoom as useZegoRoom,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
  type RemoteUser,
  type LiveKitStatus as AgoraStatus,
  type UseLiveKitRoomArgs as UseZegoRoomArgs,
} from "@/hooks/useLiveKitRoom";
