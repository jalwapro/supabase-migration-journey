import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Request core Android runtime permissions once when the native app starts.
 *
 * Microphone permission is checked by opening a short getUserMedia stream and
 * immediately stopping it; this requests OS permission without keeping the mic
 * active. Notifications are requested separately so one denial does not block
 * the other prompt. Location remains feature-triggered (country detection),
 * not a surprise launch prompt.
 */
export function InstallPermissionGate() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !Capacitor.isNativePlatform()) return;
    started.current = true;

    let cancelled = false;

    const requestLaunchPermissions = async () => {
      // Give the first screen a chance to mount before showing system dialogs.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
      if (cancelled) return;

      try {
        const mediaDevices = navigator.mediaDevices;
        if (mediaDevices?.getUserMedia) {
          const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (error) {
        // Permission denial must not prevent the notification request.
        console.info("[Permissions] Microphone permission was not granted at launch.", error);
      }

      if (cancelled) return;

      try {
        const current = await PushNotifications.checkPermissions();
        if (current.receive === "prompt" || current.receive === "prompt-with-rationale") {
          await PushNotifications.requestPermissions();
        }
      } catch (error) {
        console.info("[Permissions] Notification permission request unavailable.", error);
      }
    };

    void requestLaunchPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
