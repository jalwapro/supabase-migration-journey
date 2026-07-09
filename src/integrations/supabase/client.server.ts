import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("SUPABASE_URL not configured");
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

export const supabaseAdmin = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
