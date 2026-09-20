type Status = "idle" | "connecting" | "connected" | "error" | "disabled";
type Props = {
  roomId: string | null | undefined;
  rtcChannel: string | null | undefined;
  status: Status;
  error?: string | null;
  remotesCount?: number;
  muted?: boolean;
  speakerMuted?: boolean;
};

/**
 * Compatibility component for existing room diagnostics wiring.
 * Seat layout is owned by SeatsGrid + the mobile room CSS layers.
 * Do not inject a competing grid here.
 */
export function RoomDiagnostics(_props: Props) {
  return null;
}
