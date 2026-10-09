import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const androidDir = resolve(root, "android");
const appDir = resolve(androidDir, "app");
const manifest = resolve(appDir, "src", "main", "AndroidManifest.xml");
const appGradle = [
  resolve(appDir, "build.gradle"),
  resolve(appDir, "build.gradle.kts"),
];
const wrapper = resolve(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const googleServices = resolve(appDir, "google-services.json");
const backupDir = resolve(root, ".native-build");
const backupGoogle = resolve(backupDir, "google-services.json");
const assetsDir = resolve(appDir, "src", "main", "assets");

function run(cmd, args) {
  console.log(`[android-prepare] $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function hasAppGradle() {
  return appGradle.some((file) => existsSync(file));
}

function isCompleteAndroidPlatform() {
  return existsSync(manifest) && hasAppGradle() && existsSync(wrapper);
}

mkdirSync(backupDir, { recursive: true });

// Keep the Firebase config outside android/ while repairing a generated platform.
if (existsSync(googleServices)) {
  copyFileSync(googleServices, backupGoogle);
  console.log("[android-prepare] Preserved android/app/google-services.json");
}

if (!isCompleteAndroidPlatform()) {
  if (existsSync(androidDir)) {
    console.warn("[android-prepare] Android platform is incomplete; regenerating the generated Android project.");
    rmSync(androidDir, { recursive: true, force: true });
  } else {
    console.log("[android-prepare] Android platform is missing; adding it.");
  }

  run(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "add", "android"]);

  if (existsSync(backupGoogle)) {
    mkdirSync(appDir, { recursive: true });
    copyFileSync(backupGoogle, googleServices);
    console.log("[android-prepare] Restored Firebase google-services.json");
  }
}

if (!isCompleteAndroidPlatform()) {
  throw new Error(
    "Capacitor did not create a complete Android platform. Expected AndroidManifest.xml, app Gradle file, and Gradle wrapper under android/.",
  );
}

// Capacitor sync writes capacitor.config.json and capacitor.plugins.json here.
// Ensure this directory exists even if a previous add/sync was interrupted.
mkdirSync(assetsDir, { recursive: true });
console.log("[android-prepare] Android platform and assets directory are ready.");
