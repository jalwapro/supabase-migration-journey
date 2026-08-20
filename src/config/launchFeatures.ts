/** Jalwa current-launch feature gates. Video and PK remain preserved for future releases. */
export const LAUNCH_FEATURES = {
  voiceRooms: true,
  videoRooms: false,
  pkBattle: false,
} as const;

export type LaunchFeature = keyof typeof LAUNCH_FEATURES;

export function isLaunchFeatureEnabled(feature: LaunchFeature): boolean {
  return LAUNCH_FEATURES[feature];
}
