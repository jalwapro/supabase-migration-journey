// Firebase Cloud Messaging client wiring.
// Fetches the publishable config from /api/public/firebase-config,
// requests a token, and stores it in push_subscriptions.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { openNotification } from "@/components/NotificationPopup";
import { isNative, nativePlatform } from "@/lib/native";
import { playNotifySound } from "@/lib/notify-sound";
import type { NotificationRow } from "@/hooks/useNotifications";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

let cachedConfig: FirebaseConfig | null = null;
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let foregroundBound = false;
let nativePushBound = false;
let nativeFcmToken: string | null = null;
let nativeCurrentUserId: string | null = null;

async function enableNativeFcmForUser(userId: string): Promise<{ token: string } | null> {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted") return null;

  nativeCurrentUserId = userId;

  let resolveRegistration: ((token: string) => void) | null = null;
  const registrationPromise = new Promise<string>((resolve) => {
    resolveRegistration = resolve;
  });

  if (!nativePushBound) {
    nativePushBound = true;

    // Explicit Android notification channel. This avoids relying on an
    // implicit/default FCM channel on Android 8+.
    if (nativePlatform() === "android") {
      try {
        await PushNotifications.createChannel({
          id: "jalwa_default",
          name: "Jalwa Notifications",
          description: "Messages, gifts, follows and account updates",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
        });
      } catch (error) {
        console.warn("Jalwa notification channel setup failed", error);
      }
    }

    await PushNotifications.addListener("registration", async (token) => {
      nativeFcmToken = token.value;
      resolveRegistration?.(token.value);

      const currentUserId = nativeCurrentUserId;
      if (!currentUserId) return;

      // A native FCM token belongs to the current app installation. If the
      // same installation was previously logged in as another account, remove
      // the old ownership first so one device token cannot silently remain
      // attached to multiple users.
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("fcm_token", token.value)
        .neq("user_id", currentUserId);

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: currentUserId,
          platform: nativePlatform() === "ios" ? "ios" : "android",
          endpoint: `fcm:${token.value}`,
          fcm_token: token.value,
          p256dh: null,
          auth: null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Jalwa native",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error) console.warn("Native FCM token save failed", error);
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("Native FCM registration failed", error);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      playNotifySound();
      const data = notification.data ?? {};
      const notifId = data.notifId;
      if (notifId && nativeCurrentUserId) {
        openNotification({
          id: String(notifId),
          user_id: nativeCurrentUserId,
          actor_id: (data.sender_id as string) ?? null,
          kind: ((data.kind as string) ?? "system_broadcast") as NotificationRow["kind"],
          title: notification.title ?? (data.title as string) ?? "New notification",
          body: notification.body ?? (data.body as string) ?? null,
          entity_type: (data.entity_type as string) ?? null,
          entity_id: (data.entity_id as string) ?? null,
          data: data as Record<string, unknown>,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      }
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data ?? {};
      const notifId = data.notifId;
      if (notifId && nativeCurrentUserId) {
        openNotification({
          id: String(notifId),
          user_id: nativeCurrentUserId,
          actor_id: (data.sender_id as string) ?? null,
          kind: ((data.kind as string) ?? "system_broadcast") as NotificationRow["kind"],
          title: action.notification.title ?? (data.title as string) ?? "New notification",
          body: action.notification.body ?? (data.body as string) ?? null,
          entity_type: (data.entity_type as string) ?? null,
          entity_id: (data.entity_id as string) ?? null,
          data: data as Record<string, unknown>,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      }
    });
  }

  await PushNotifications.register();

  if (!nativeFcmToken) {
    nativeFcmToken = await Promise.race([
      registrationPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("FCM registration timeout")), 10000),
      ),
    ]).catch(() => null);
  }

  return nativeFcmToken ? { token: nativeFcmToken } : null;
}

export function isFcmSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

function validateConfig(value: unknown): FirebaseConfig {
  if (!value || typeof value !== "object") {
    throw new Error("Firebase config response is invalid");
  }

  const cfg = value as Partial<FirebaseConfig>;
  const required: Array<keyof FirebaseConfig> = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
    "vapidKey",
  ];
  const missing = required.filter((key) => !cfg[key]);
  if (missing.length > 0) {
    throw new Error(`Firebase config incomplete: ${missing.join(", ")}`);
  }

  return cfg as FirebaseConfig;
}

async function loadConfig(): Promise<FirebaseConfig> {
  if (cachedConfig) return cachedConfig;

  const res = await fetch("/api/public/firebase-config", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}

  if (!res.ok) {
    const serverMessage =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message ?? "")
        : "";
    throw new Error(serverMessage || `firebase-config fetch failed: ${res.status}`);
  }

  cachedConfig = validateConfig(body);
  return cachedConfig;
}

async function ensureMessaging(): Promise<Messaging> {
  if (messaging) return messaging;
  const cfg = await loadConfig();
  app = getApps()[0] ?? initializeApp(cfg);
  messaging = getMessaging(app);
  return messaging;
}

async function registerSwWithConfig(cfg: FirebaseConfig): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
  const swUrl = `/firebase-messaging-sw.js?${params.toString()}`;
  return navigator.serviceWorker.register(swUrl, {
    scope: "/firebase-cloud-messaging-push-scope",
    updateViaCache: "none",
  });
}

function bindForegroundHandler(m: Messaging) {
  if (foregroundBound) return;
  foregroundBound = true;
  onMessage(m, (payload) => {
    playNotifySound();
    const data = payload.data ?? {};
    const notifId = data.notifId;
    if (notifId) {
      openNotification({
        id: String(notifId),
        user_id: "",
        actor_id: (data.sender_id as string) ?? null,
        kind: ((data.kind as string) ?? "system_broadcast") as NotificationRow["kind"],
        title: payload.notification?.title ?? (data.title as string) ?? "New notification",
        body: payload.notification?.body ?? (data.body as string) ?? null,
        entity_type: (data.entity_type as string) ?? null,
        entity_id: (data.entity_id as string) ?? null,
        data: data as Record<string, unknown>,
        read_at: null,
        created_at: new Date().toISOString(),
      });
    }
  });
}

export async function enableFcmForUser(userId: string): Promise<{ token: string } | null> {
  if (isNative()) return enableNativeFcmForUser(userId);
  if (!isFcmSupported()) return null;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const cfg = await loadConfig();
  const swReg = await registerSwWithConfig(cfg);
  const m = await ensureMessaging();
  bindForegroundHandler(m);

  const token = await getToken(m, {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: swReg,
  });
  if (!token) return null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      platform: "web",
      endpoint: `fcm:${token}`,
      fcm_token: token,
      p256dh: null,
      auth: null,
      user_agent: navigator.userAgent,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
  return { token };
}

export async function initFcmIfGranted(userId: string): Promise<void> {
  if (isNative()) {
    try {
      await enableNativeFcmForUser(userId);
    } catch (e) {
      console.warn("Native FCM init failed", e);
    }
    return;
  }
  if (!isFcmSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    await enableFcmForUser(userId);
  } catch (e) {
    console.warn("FCM init failed", e);
  }
}

const AUTO_PROMPT_KEY = "jalwa_fcm_auto_prompted_v1";

export async function autoEnableFcm(userId: string): Promise<void> {
  if (isNative()) {
    // Permission UI is owned by InstallPermissionGate. Do not trigger a
    // second native permission popup from the FCM bootstrap.
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permission = await PushNotifications.checkPermissions();
      if (permission.receive !== "granted") return;
      await enableNativeFcmForUser(userId);
    } catch (e) {
      console.warn("Native FCM auto-init failed", e);
    }
    return;
  }
  if (!isFcmSupported()) return;
  const perm = Notification.permission;

  if (perm === "granted") {
    try {
      await enableFcmForUser(userId);
    } catch (e) {
      console.warn("FCM auto-init failed", e);
    }
    return;
  }

  if (perm === "denied") return;

  try {
    const key = `${AUTO_PROMPT_KEY}:${userId}`;
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
  } catch {}

  window.setTimeout(() => {
    void enableFcmForUser(userId).catch((e) =>
      console.warn("FCM auto-enable failed", e),
    );
  }, 2500);
}
