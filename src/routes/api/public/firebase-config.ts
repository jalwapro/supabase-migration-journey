import { createFileRoute } from "@tanstack/react-router";

// Firebase Web SDK config is publishable — safe to expose to browser.
// We serve it from an endpoint so the apiKey stays in the server-only
// GOOGLE_API_KEY secret and isn't baked into static bundles.
export const Route = createFileRoute("/api/public/firebase-config")({
  server: {
    handlers: {
      GET: async () => {
        const config = {
          apiKey: process.env.GOOGLE_API_KEY ?? "",
          authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
          projectId: process.env.FIREBASE_PROJECT_ID ?? "",
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
          appId: process.env.FIREBASE_APP_ID ?? "",
          vapidKey:
            "BGHZZP4kZNgYgh0ThBLiakr3-aGURy0NBIpQa3cpTQwmEWthsQzmS_aACKi0haUPDl7BtHkUSwl5yN5Ytqk-wRU",
        };
        return Response.json(config, {
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
