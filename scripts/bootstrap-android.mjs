import { execFileSync } from "node:child_process";

const root = process.cwd();

function run(cmd, args) {
  console.log(`[android-bootstrap] $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

// Repair missing/incomplete generated files without deleting a valid Android project.
run(
  process.platform === "win32" ? "node.exe" : "node",
  ["scripts/prepare-android-platform.mjs"],
);
run(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "android"]);
run(
  process.platform === "win32" ? "node.exe" : "node",
  ["scripts/ensure-android-permissions.mjs"],
);

console.log("[android-bootstrap] Capacitor Android platform is ready.");
