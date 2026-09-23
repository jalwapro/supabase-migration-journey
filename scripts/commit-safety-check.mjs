#!/usr/bin/env node
import { execSync } from "node:child_process";

const base=process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "HEAD~1";
let files=[];
try { files=execSync(`git diff --name-only ${base}...HEAD`,{encoding:"utf8"}).trim().split(/\\r?\\n/).filter(Boolean); } catch {}
const risky=[
  [/livekit|token|room-api/i,"LiveKit/token/room API"],
  [/supabase\/functions\/(easypaisa|jazzcash|.*token)/i,"payment/auth Edge Function"],
  [/db\/migrations\//i,"database migration"],
  [/admin\.(finance|payment|recharge|withdraw)/i,"finance/admin flow"],
  [/rls|security|policy/i,"RLS/security policy"],
];
const hits=[];
for(const f of files) for(const [re,area] of risky) if(re.test(f)) hits.push(`${area}: ${f}`);
if(hits.length){
 console.warn("\n⚠️ JALWA COMMIT GUARD WARNING");
 console.warn("This change touches a protected/high-risk area. Verify the exact behavior and build before merging/deploying.");
 for(const h of [...new Set(hits)]) console.warn(" - "+h);
 console.warn("Do not modify LiveKit token/room APIs unless the task explicitly requires it.");
 console.warn("Do not deploy a database migration without checking it against the current live schema.\n");
}
console.log(`JALWA Commit Guard: checked ${files.length} changed file(s).`);
