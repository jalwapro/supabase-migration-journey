import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");
const permissions = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
];

const missing = permissions.filter(
  (permission) => !xml.includes(`android:name="${permission}"`),
);

if (missing.length === 0) {
  console.log("✓ Android camera, microphone, location and notification permissions already declared.");
  process.exit(0);
}

const declarations = missing
  .map((permission) => `    <uses-permission android:name="${permission}" />`)
  .join("\n");

const applicationIndex = xml.indexOf("<application");
if (applicationIndex === -1) {
  throw new Error("Could not find <application> in AndroidManifest.xml");
}

xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
writeFileSync(manifestPath, xml);
console.log(`✓ Added Android permissions: ${missing.join(", ")}`);
