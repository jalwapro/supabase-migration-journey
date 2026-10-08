/**
 * Native permission gate intentionally disabled.
 *
 * Sensitive permissions are requested at the moment the related feature is
 * used: microphone from the voice-room flow and notifications from notification
 * settings/FCM. Jalwa does not request location on launch.
 */
export function InstallPermissionGate() {
  return null;
}
