import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/native";

/**
 * Requests Android's foreground location and notification permissions once per
 * signed-in session. The related features still handle denied permissions and
 * can request them again from their own settings/actions.
 */
export function InstallPermissionGate() {
  const { user } = useAuth();
  const requestedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !isNative() || requestedUser.current === user.id) return;
    requestedUser.current = user.id;
    let cancelled = false;

    void (async () => {
      // Ask for foreground GPS access through Capacitor, not WebView geolocation.
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
          permission = await Geolocation.requestPermissions();
        }
      } catch (error) {
        console.warn("[permissions] native location permission request failed", error);
      }

      if (cancelled) return;

      // This native flow asks for Android 13+ notification permission and then
      // registers the FCM token for the signed-in user.
      try {
        const { enableFcmForUser } = await import("@/lib/fcm-client");
        await enableFcmForUser(user.id);
      } catch (error) {
        console.warn("[permissions] native notification setup failed", error);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return null;
}
