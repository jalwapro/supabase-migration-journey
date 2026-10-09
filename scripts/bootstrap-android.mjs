import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const androidDir = resolve(root, "android");
const googleServices = resolve(androidDir, "app", "google-services.json");
const backupDir = resolve(root, ".native-build");
const backupGoogle = resolve(backupDir, "google-services.json");

function run(cmd, args) {
  console.log(`[android-bootstrap] $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

// This app uses TanStack Start SSR and remote same-origin /api routes, so the
// production Capacitor shell intentionally loads https://www.jalwa.pro rather
// than requiring a nonexistent dist/client/index.html.
mkdirSync(backupDir, { recursive: true });

if (existsSync(googleServices)) {
  copyFileSync(googleServices, backupGoogle);
  console.log("[android-bootstrap] Preserved android/app/google-services.json");
}

if (existsSync(androidDir)) {
  rmSync(androidDir, { recursive: true, force: true });
  console.log("[android-bootstrap] Removed incomplete generated Android platform");
}

run(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "add", "android"]);

if (existsSync(backupGoogle)) {
  mkdirSync(dirname(googleServices), { recursive: true });
  copyFileSync(backupGoogle, googleServices);
  console.log("[android-bootstrap] Restored Firebase google-services.json");
}

// Capacitor normally creates this during platform add; ensure it exists before sync
// so a partially generated platform does not fail while writing config/plugin files.
mkdirSync(resolve(androidDir, "app", "src", "main", "assets"), { recursive: true });

run(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "android"]);
run(process.platform === "win32" ? "node.exe" : "node", ["scripts/ensure-android-permissions.mjs"]);

console.log("[android-bootstrap] Capacitor Android platform is ready.");
