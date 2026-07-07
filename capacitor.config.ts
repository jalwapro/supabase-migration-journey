import type { CapacitorConfig } from "@capacitor/cli";

// Jalwa — Capacitor native wrapper config.
// The web app is a TanStack Start SSR app deployed on Lovable Cloud.
// For the native shell we load the published Lovable URL directly
// (hot-reload friendly, no SSR bundling on device).
//
// After you publish the web app, update `server.url` to your production URL
// (e.g. https://project--<id>.lovable.app) and run:
//   bun run build:web      # generates dist/ as a fallback
//   npx cap sync
//   npx cap open android   # or: npx cap open ios
const config: CapacitorConfig = {
  appId: "app.lovable.jalwa",
  appName: "Jalwa",
  webDir: "dist/client",
  server: {
    // Point the native shell at your published web app. Comment out to run
    // fully offline from bundled `webDir` assets.
    url: "https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1a0d2e",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a0d2e",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
