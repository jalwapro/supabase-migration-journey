/** Jalwa launch scope: audio voice rooms + chat only. Video and PK are disabled. */
export const LAUNCH_FEATURES = {
  voiceRooms: true,
  videoRooms: false,
  pkBattle: false,
} as const;

export type LaunchFeature = keyof typeof LAUNCH_FEATURES;

export function isLaunchFeatureEnabled(feature: LaunchFeature): boolean {
  return LAUNCH_FEATURES[feature];
}
