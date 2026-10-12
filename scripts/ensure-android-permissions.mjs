import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");
xml = xml.replace(/\s*<uses-permission android:name="android\.permission\.CAMERA"\s*\/\>/g, "");

const permissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  // The app uses navigator.geolocation to auto-detect country/city and for the location setting.
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  // Declaring this is required on Android 13+; runtime request is made by the native push flow.
  "android.permission.POST_NOTIFICATIONS",
];

const missing = permissions.filter(
  (permission) => !xml.includes(`android:name="${permission}"`),
);

const declarations = missing
  .map((permission) => `    <uses-permission android:name="${permission}" />`)
  .join("\n");

const applicationIndex = xml.indexOf("<application");
if (applicationIndex === -1) {
  throw new Error("Could not find <application> in AndroidManifest.xml");
}

const fcmChannelMeta =
  '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="jalwa_default" />';

if (!xml.includes("com.google.firebase.messaging.default_notification_channel_id")) {
  const closeIndex = xml.indexOf(">", applicationIndex);
  if (closeIndex === -1) throw new Error("Could not parse <application> in AndroidManifest.xml");
  xml = xml.slice(0, closeIndex + 1) + "\n" + fcmChannelMeta + xml.slice(closeIndex + 1);
}

xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
writeFileSync(manifestPath, xml);

console.log("✓ Android permissions configured without a persistent background service.");
