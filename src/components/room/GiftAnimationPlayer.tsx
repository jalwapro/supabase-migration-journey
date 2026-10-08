import { StableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";

type Props = { roomId: string };

/** Single room-wide gift playback surface. */
export function GiftAnimationPlayer({ roomId }: Props) {
  return <StableGiftAnimationPlayer roomId={roomId} />;
}
