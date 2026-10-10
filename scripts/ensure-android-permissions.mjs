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
const oauthScheme = "app.lovable.jalwa";
if (!xml.includes(`android:scheme="${oauthScheme}"`)) {
  // cap sync regenerates AndroidManifest.xml; keep the native OAuth callback
  // in this post-sync script so it is restored idempotently on every build.
  const activityOpen = /<activity\b(?=[^>]*android:name="[^"]*MainActivity")[^>]*>/m.exec(xml);
  if (!activityOpen) {
    throw new Error("Could not find MainActivity for the native OAuth callback");
  }
  const activityStart = activityOpen.index + activityOpen[0].length;
  const activityClose = xml.indexOf("</activity>", activityStart);
  if (activityClose === -1) throw new Error("Could not find the closing MainActivity tag");
  const oauthIntentFilter = `
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="${oauthScheme}" android:host="auth" android:pathPrefix="/callback" />
        </intent-filter>
`;
  xml = xml.slice(0, activityClose) + oauthIntentFilter + xml.slice(activityClose);
}

writeFileSync(manifestPath, xml);

console.log("✓ Android permissions configured without a persistent background service.");
