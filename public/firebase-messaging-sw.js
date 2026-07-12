/* Firebase Cloud Messaging service worker.
   Handles background push notifications. Config is passed via query
   string when the worker is registered from src/lib/fcm-client.ts. */

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

(function initFcmSw() {
  try {
    const url = new URL(self.location.href);
    const cfg = {
      apiKey: url.searchParams.get("apiKey") || "",
      authDomain: url.searchParams.get("authDomain") || "",
      projectId: url.searchParams.get("projectId") || "",
      storageBucket: url.searchParams.get("storageBucket") || "",
      messagingSenderId: url.searchParams.get("messagingSenderId") || "",
      appId: url.searchParams.get("appId") || "",
    };
    if (!cfg.apiKey || !cfg.projectId) {
      console.warn("[fcm-sw] Missing config in registration URL");
      return;
    }
    // eslint-disable-next-line no-undef
    firebase.initializeApp(cfg);
    // eslint-disable-next-line no-undef
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) ||
        (payload.data && payload.data.title) || "Jalwa";
      const body = (payload.notification && payload.notification.body) ||
        (payload.data && payload.data.body) || "";
      const data = payload.data || {};
      const options = {
        body,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: data.kind || data.notifId || "jalwa",
        renotify: true,
        vibrate: [80, 40, 120],
        data: { url: data.url || "/notifications", ...data },
      };
      self.registration.showNotification(title, options);
    });
  } catch (e) {
    console.error("[fcm-sw] init failed", e);
  }
})();

// Fallback for reliability on mobile (Android Chrome / Samsung Internet):
// if a push arrives while the app is completely closed and Firebase's
// onBackgroundMessage handler doesn't fire (or the payload has no
// `notification` field), show the notification straight from the raw
// PushEvent so the user always gets a system-tray alert.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* ignore */ }
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "Jalwa";
  const body = n.body || d.body || "";
  const url = d.url || (d.kind === "dm_new" && d.sender_id ? `/messages/${d.sender_id}` : "/notifications");
  // Only show if FCM's SDK handler hasn't already displayed one for this tag.
  event.waitUntil((async () => {
    const tag = d.kind || d.notifId || "jalwa";
    const existing = await self.registration.getNotifications({ tag });
    if (existing && existing.length > 0) return;
    await self.registration.showNotification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag,
      renotify: true,
      vibrate: [80, 40, 120],
      requireInteraction: false,
      data: { url, ...d },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || "/notifications";
  if (data.kind === "dm_new" && data.sender_id) {
    url = `/messages/${data.sender_id}`;
  }
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          try { await client.focus(); } catch { /* noop */ }
          try { client.postMessage({ type: "jalwa:notif-click", url, data }); } catch { /* noop */ }
          if ("navigate" in client) {
            try { await client.navigate(url); } catch { /* noop */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
