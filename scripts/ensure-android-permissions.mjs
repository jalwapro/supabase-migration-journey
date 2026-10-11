import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml");

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");

// Jalwa is an audio/chat app; remove stale camera and unused foreground-service declarations.
xml = xml.replace(/\s*<uses-permission android:name="android\.permission\.CAMERA"\s*\/\s*>/g, "");
xml = xml.replace(/\s*<uses-permission android:name="android\.permission\.FOREGROUND_SERVICE(?:_MICROPHONE)?"\s*\/\s*>/g, "");
xml = xml.replace(/\s*<service(?=[^>]*android:name="\.MicrophoneForegroundService")[^>]*\/>/g, "");

const permissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];
const missing = permissions.filter((permission) => !xml.includes(`android:name="${permission}"`));
if (missing.length) {
  const applicationIndex = xml.indexOf("<application");
  if (applicationIndex < 0) throw new Error("Could not find <application> in AndroidManifest.xml");
  const declarations = missing.map((permission) => `    <uses-permission android:name="${permission}" />`).join("\n");
  xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
}

const applicationIndex = xml.indexOf("<application");
if (applicationIndex < 0) throw new Error("Could not find <application> in AndroidManifest.xml");
const appOpenEnd = xml.indexOf(">", applicationIndex);
if (appOpenEnd < 0) throw new Error("Could not parse <application> in AndroidManifest.xml");

const fcmChannelMeta =
  '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="jalwa_default" />';
if (!xml.includes("com.google.firebase.messaging.default_notification_channel_id")) {
  xml = xml.slice(0, appOpenEnd + 1) + "\n" + fcmChannelMeta + xml.slice(appOpenEnd + 1);
}

writeFileSync(manifestPath, xml);
console.log("✓ Android microphone, notification and location permissions configured.");
