import { createFileRoute } from "@tanstack/react-router";

/**
 * Public Firebase Web SDK configuration.
 *
 * The browser only receives the Firebase Web config. Never expose
 * FCM_SERVICE_ACCOUNT_JSON or any other server credential here.
 *
 * Production supports the single FIREBASE_WEB_CONFIG_JSON variable used by
 * the push diagnostics, with individual FIREBASE_* variables as a fallback.
 * This keeps the endpoint compatible with both existing Vercel setups.
 */
type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonConfig(): Partial<FirebaseWebConfig> {
  const raw = clean(process.env.FIREBASE_WEB_CONFIG_JSON);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      apiKey: clean(parsed.apiKey),
      authDomain: clean(parsed.authDomain),
      projectId: clean(parsed.projectId),
      storageBucket: clean(parsed.storageBucket),
      messagingSenderId: clean(parsed.messagingSenderId),
      appId: clean(parsed.appId),
    };
  } catch {
    throw new Error("FIREBASE_WEB_CONFIG_JSON is not valid JSON");
  }
}

function getConfig(): FirebaseWebConfig {
  const json = readJsonConfig();

  const config: FirebaseWebConfig = {
    apiKey:
      json.apiKey ||
      clean(process.env.FIREBASE_API_KEY) ||
      clean(process.env.GOOGLE_API_KEY) ||
      "AIzaSyDO0ovhZ84D-64RvAjbHGxOlP6mDkrw6pA",
    authDomain:
      json.authDomain ||
      clean(process.env.FIREBASE_AUTH_DOMAIN) ||
      "jalwa-84344.firebaseapp.com",
    projectId:
      json.projectId ||
      clean(process.env.FIREBASE_PROJECT_ID) ||
      "jalwa-84344",
    storageBucket:
      json.storageBucket ||
      clean(process.env.FIREBASE_STORAGE_BUCKET) ||
      "jalwa-84344.firebasestorage.app",
    messagingSenderId:
      json.messagingSenderId ||
      clean(process.env.FIREBASE_MESSAGING_SENDER_ID) ||
      "923506443706",
    appId:
      json.appId ||
      clean(process.env.FIREBASE_APP_ID) ||
      "1:923506443706:web:8ba07acae0d09cdd9a4983",
  };

  // Firebase Web config is publishable, but it must still be complete enough
  // for initializeApp/getToken to work. Fail clearly instead of returning an
  // empty config that causes a misleading client-side error.
  const missing = (Object.keys(config) as Array<keyof FirebaseWebConfig>).filter(
    (key) => !config[key],
  );

  if (missing.length > 0) {
    throw new Error(`Firebase Web config missing: ${missing.join(", ")}`);
  }

  return config;
}

export const Route = createFileRoute("/api/public/firebase-config")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = getConfig();
          const vapidKey =
            clean(process.env.FIREBASE_VAPID_KEY) ||
            clean(process.env.VAPID_PUBLIC_KEY) ||
            "BGHZZP4kZNgYgh0ThBLiakr3-aGURy0NBIpQa3cpTQwmEWthsQzmS_aACKi0haUPDl7BtHkUSwl5yN5Ytqk-wRU";

          if (!vapidKey) {
            throw new Error("Firebase Web Push VAPID key is missing");
          }

          return Response.json(
            { ...config, vapidKey },
            {
              headers: {
                "cache-control": "public, max-age=300, stale-while-revalidate=600",
              },
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Firebase config unavailable";
          console.error("[firebase-config]", message);
          return Response.json(
            { error: "Firebase notifications are not configured", message },
            {
              status: 503,
              headers: { "cache-control": "no-store" },
            },
          );
        }
      },
    },
  },
});
