// Firebase Cloud Messaging client wiring.
// Fetches the publishable config from /api/public/firebase-config,
// requests a token, and stores it in push_subscriptions.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { openNotification } from "@/components/NotificationPopup";
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

export function isFcmSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

async function loadConfig(): Promise<FirebaseConfig> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch("/api/public/firebase-config");
  if (!res.ok) throw new Error(`firebase-config fetch failed: ${res.status}`);
  cachedConfig = (await res.json()) as FirebaseConfig;
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
  // Pass config via query string so the SW can init without another fetch.
  const params = new URLSearchParams({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
  const swUrl = `/firebase-messaging-sw.js?${params.toString()}`;
  return navigator.serviceWorker.register(swUrl, { scope: "/firebase-cloud-messaging-push-scope" });
}

function bindForegroundHandler(m: Messaging) {
  if (foregroundBound) return;
  foregroundBound = true;
  onMessage(m, (payload) => {
    playNotifySound();
    // If we get a full notification row via data, open the popup.
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

/**
 * Request notification permission and register the FCM token for this user.
 * Idempotent — safe to call on every app start after login.
 */
export async function enableFcmForUser(userId: string): Promise<{ token: string } | null> {
  if (!isFcmSupported()) return null;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const cfg = await loadConfig();
  if (!cfg.apiKey) throw new Error("Firebase config not configured on server");

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
      platform: "fcm",
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

/**
 * Best-effort silent init on app load. Only registers the SW + foreground
 * handler if permission is already granted. Does NOT prompt.
 */
export async function initFcmIfGranted(userId: string): Promise<void> {
  if (!isFcmSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    await enableFcmForUser(userId);
  } catch (e) {
    console.warn("FCM init failed", e);
  }
}

const AUTO_PROMPT_KEY = "jalwa_fcm_auto_prompted_v1";

/**
 * Auto-enable notifications on login:
 * - If already granted → silently register token
 * - If denied → skip (user must re-enable from browser settings)
 * - If default → prompt ONCE per user (tracked in localStorage), after a
 *   short delay so it doesn't collide with other startup prompts.
 */
export async function autoEnableFcm(userId: string): Promise<void> {
  if (!isFcmSupported()) return;
  const perm = Notification.permission;
  if (perm === "granted") {
    try { await enableFcmForUser(userId); } catch (e) { console.warn("FCM auto-init failed", e); }
    return;
  }
  if (perm === "denied") return;
  try {
    const key = `${AUTO_PROMPT_KEY}:${userId}`;
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
  } catch { /* noop */ }
  // Delay to avoid clashing with mic/camera install gate.
  window.setTimeout(() => {
    void enableFcmForUser(userId).catch((e) => console.warn("FCM auto-enable failed", e));
  }, 2500);
}

