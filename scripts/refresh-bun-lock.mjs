import { execSync } from "node:child_process";
execSync("bun install --lockfile-only", { stdio: "inherit" });
