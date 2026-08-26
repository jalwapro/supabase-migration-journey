/**
 * Stable gift animation entry point.
 *
 * The previous implementation pulled several heavy animation modules into one
 * eager chunk and could fail at runtime with a Vite/ES module TDZ error:
 * "Cannot access 'q' before initialization".
 *
 * Keep the public component name unchanged so existing dynamic imports and
 * callers continue to work, while delegating to the crash-safe renderer.
 * SafeGiftAnimationPlayer consumes the same gift_sends realtime stream and
 * uses the Gift Studio render_config snapshot for video positioning/crop/
 * scaling and playback timing.
 */
export { SafeGiftAnimationPlayer as GiftAnimationPlayer } from "./SafeGiftAnimationPlayer";
