import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const AUTH_STORAGE_KEY = "jalwa-auth";

function getLegacyStorageKey() {
  try {
    if (!url) return null;
    const projectRef = new URL(url).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

const legacyStorageKey = getLegacyStorageKey();

const resilientAuthStorage = {
  getItem(storageKey: string) {
    if (typeof window === "undefined") return null;
    try {
      const primary = window.localStorage.getItem(storageKey);
      if (primary) return primary;

      // Earlier builds used Supabase's default key. Keep reading it so users
      // are not asked to sign in again after the app switched to jalwa-auth.
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        const legacy = window.localStorage.getItem(legacyStorageKey);
        if (legacy) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, legacy);
          return legacy;
        }
      }
    } catch (error) {
      console.warn("[supabase] auth storage read failed", error);
    }
    return null;
  },
  setItem(storageKey: string, value: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, value);
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        window.localStorage.setItem(legacyStorageKey, value);
      }
    } catch (error) {
      console.warn("[supabase] auth storage write failed", error);
    }
  },
  removeItem(storageKey: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        window.localStorage.removeItem(legacyStorageKey);
      }
    } catch (error) {
      console.warn("[supabase] auth storage remove failed", error);
    }
  },
};

if (!url || !key) {
  // Fail loud in dev so misconfig is obvious.
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Check .env",
  );
}

export const supabase: SupabaseClient = createClient(url ?? "", key ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
    storage: resilientAuthStorage,
  },
});
