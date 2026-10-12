import { memo } from "react";
import { StableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";

type Props = { roomId: string };

/**
 * Single room-wide gift playback surface.
 * RoomPage updates frequently (chat, presence, seats); keep those parent renders
 * from needlessly re-rendering the expensive gift player when the room is unchanged.
 * The player still re-renders for its own gift/queue/media state updates.
 */
export const GiftAnimationPlayer = memo(function GiftAnimationPlayer({ roomId }: Props) {
  return <StableGiftAnimationPlayer roomId={roomId} />;
});
