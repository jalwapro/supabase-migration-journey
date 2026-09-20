// Compatibility wrapper: the room now has one canonical gift renderer.
// Keeping this export avoids breaking older imports while preventing a second
// independent playback queue from rendering the same gift twice.
export { StableGiftAnimationPlayer as ReliableGiftAnimationPlayer } from "./StableGiftAnimationPlayer";
