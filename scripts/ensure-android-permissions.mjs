import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");

// All required native permissions for Jalwa:
// - Voice / Audio: Mic, Audio settings, Bluetooth headset connect
// - Video / Photo: Camera, Media images & video (Android 13+), Storage (Android 12-)
// - Location: Foreground GPS for nearby rooms & regional leaderboards
// - System: Push notifications, vibration, wake lock
const permissions = [
  "android.permission.INTERNET",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.CAMERA",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.VIBRATE",
  "android.permission.WAKE_LOCK",
];

const hardwareFeatures = [
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.location" android:required="false" />',
];

const missing = permissions.filter(
  (permission) => !xml.includes(`android:name="${permission}"`),
);

const missingFeatures = hardwareFeatures.filter(
  (feat) => !xml.includes(feat.replace(/\s+/g, " ").trim()),
);

const declarations = [
  ...missing.map((permission) => `    <uses-permission android:name="${permission}" />`),
  ...missingFeatures.map((feat) => `    ${feat}`),
].join("\n");

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

if (declarations.trim()) {
  xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
}

writeFileSync(manifestPath, xml);

console.log("✓ Android permissions and hardware features verified in AndroidManifest.xml.");
