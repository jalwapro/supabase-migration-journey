## Plan: Premium notifications + FCM background push

Aap ne FCM chuna. Achhi khabar — backend (FCM sender, webhook, DB table `push_subscriptions.fcm_token`) already scaffolded hai. Ab client-side FCM + popup redesign + sound karna hai.

### 1. Premium in-app popup + sound
- `NotificationPopup.tsx` redesign: gradient border, gold accent, kind-specific icon (💬 DM, 🎁 gift, 💰 wallet, 👥 friend), smooth slide-in from top, avatar chip agar `actor_id` ho.
- Notification sound: naya file `public/sounds/notify.mp3` (short chime). Popup open hote hi play (agar tab hidden nahi hai) + haptic vibrate on mobile.
- Sound sirf jab user gesture ke baad hua ho (autoplay policy). Pehli baar Notification permission grant ke waqt sound unlock kar denge.

### 2. Firebase Cloud Messaging setup (aapko karna hai — 5 min)
Aapko Firebase Console pe:
1. Naya project banao: https://console.firebase.google.com
2. **Project Settings → General → Your apps → Web app** add karo → wahan se **Firebase config** milega (apiKey, authDomain, projectId, messagingSenderId, appId). Ye publishable hain, code me ja sakte hain.
3. **Cloud Messaging tab → Web configuration → Generate key pair** → **VAPID public key** milega (Web Push certificate).
4. **Project Settings → Service accounts → Generate new private key** → JSON download hoga. Ye secret hai.

Aap ye 3 cheezein bhejo:
- **Firebase web config** (JSON snippet, publishable — chat me paste kar do)
- **VAPID public key** (`BN...` string, publishable — chat me paste kar do)
- **Service account JSON** (secret — main `add_secret` form open karunga `FCM_SERVICE_ACCOUNT_JSON` ke liye)

### 3. Frontend FCM wiring (aapke config ke baad)
- `bun add firebase`
- Naya `src/lib/fcm-client.ts`: initialize Firebase app, `getMessaging`, `getToken({vapidKey})`, save to `push_subscriptions` with `platform='fcm'` + `fcm_token`.
- Naya `public/firebase-messaging-sw.js`: background handler jo notification dikhata hai jab tab band ho. Firebase config yahan bhi hardcode hota hai (publishable).
- `onMessage` foreground handler: agar app khula hai to hamara premium in-app popup dikhao (silent push).
- Notification settings screen me "Enable Android/background notifications" toggle jo permission maangega aur FCM token register karega.

### 4. Wiring (already done, verify)
- `push-webhook.ts` already `fcm_token` handle karta hai aur `sendFcmMessage` call karta hai — kaam karega jaise hi tokens save honge.
- DB trigger jo notifications insert pe webhook call karta hai — verify karunga chal raha hai.

### Files
```text
CHANGE   src/components/NotificationPopup.tsx        (redesign + sound)
NEW      public/sounds/notify.mp3                     (chime)
NEW      src/lib/fcm-client.ts                        (token registration)
NEW      public/firebase-messaging-sw.js              (background push)
CHANGE   src/routes/notifications.tsx or settings     (enable-push toggle)
```

### Kya karein ab
Sirf **step 1 (popup + sound)** abhi implement kar dun (koi credentials nahi chahiyeen), aur saath hi `FCM_SERVICE_ACCOUNT_JSON` secret form open karun — jab aap Firebase config + VAPID key chat me paste karo, step 3 fatafat kar dunga.

Confirm karo to shuru karun?
