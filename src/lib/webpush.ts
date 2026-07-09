import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function isWebPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export async function currentPushStatus(): Promise<"unsupported" | "denied" | "granted" | "default" | "subscribed"> {
  if (!isWebPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub && Notification.permission === "granted") return "subscribed";
  return Notification.permission as "granted" | "default";
}

export async function subscribeToPush(userId: string) {
  if (!VAPID_PUBLIC) throw new Error("VAPID public key not configured");
  if (!isWebPushSupported()) throw new Error("Push not supported in this browser");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission denied");
  const reg = await getPushRegistration();
  if (!reg) throw new Error("Service worker registration failed");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh ?? null;
  const auth = json.keys?.auth ?? null;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      platform: "web",
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
  return sub;
}

export async function unsubscribeFromPush(userId: string) {
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  }
}
