import type { CapacitorConfig } from "@capacitor/cli";

// Jalwa — Capacitor native wrapper config.
// Native production builds load bundled files from webDir. Backend APIs remain remote; no server.url is used.
// The native shell loads the bundled production web app directly.
//
// After changing this file, rebuild the web app and sync the native projects:
//   bun run build
//   npx cap sync
//   npx cap open android   # or: npx cap open ios
const config: CapacitorConfig = {
  appId: "app.lovable.jalwa",
  appName: "Jalwa",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      backgroundColor: "#1a0d2e",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    SystemBars: {
      // Capacitor 8 handles Android edge-to-edge through CSS insets.
      // Keep the injected safe-area variables available to the web app.
      insetsHandling: "css",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a0d2e",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
    },
    PushNotifications: {
      presentationOptions: ["alert", "sound", "badge"],
    },
  },
};

export default config;
