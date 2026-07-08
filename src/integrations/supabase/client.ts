import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

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

function shouldUseNativeStorage() {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getNativeAuthItem(storageKey: string) {
  if (!shouldUseNativeStorage()) return null;
  try {
    const { value } = await Preferences.get({ key: storageKey });
    return value;
  } catch (error) {
    console.warn("[supabase] native auth storage read failed", error);
    return null;
  }
}

async function setNativeAuthItem(storageKey: string, value: string) {
  if (!shouldUseNativeStorage()) return;
  try {
    await Preferences.set({ key: storageKey, value });
  } catch (error) {
    console.warn("[supabase] native auth storage write failed", error);
  }
}

async function removeNativeAuthItem(storageKey: string) {
  if (!shouldUseNativeStorage()) return;
  try {
    await Preferences.remove({ key: storageKey });
  } catch (error) {
    console.warn("[supabase] native auth storage remove failed", error);
  }
}

const resilientAuthStorage = {
  async getItem(storageKey: string) {
    if (typeof window === "undefined") return null;
    try {
      const primary = window.localStorage.getItem(storageKey);
      if (primary) return primary;

      const nativePrimary = await getNativeAuthItem(storageKey);
      if (nativePrimary) {
        window.localStorage.setItem(storageKey, nativePrimary);
        if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
          window.localStorage.setItem(legacyStorageKey, nativePrimary);
        }
        return nativePrimary;
      }

      // Earlier builds used Supabase's default key. Keep reading it so users
      // are not asked to sign in again after the app switched to jalwa-auth.
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        const legacy = window.localStorage.getItem(legacyStorageKey);
        if (legacy) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, legacy);
          void setNativeAuthItem(AUTH_STORAGE_KEY, legacy);
          return legacy;
        }

        const nativeLegacy = await getNativeAuthItem(legacyStorageKey);
        if (nativeLegacy) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, nativeLegacy);
          window.localStorage.setItem(legacyStorageKey, nativeLegacy);
          void setNativeAuthItem(AUTH_STORAGE_KEY, nativeLegacy);
          return nativeLegacy;
        }
      }
    } catch (error) {
      console.warn("[supabase] auth storage read failed", error);
    }
    return null;
  },
  async setItem(storageKey: string, value: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, value);
      await setNativeAuthItem(storageKey, value);
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        window.localStorage.setItem(legacyStorageKey, value);
        await setNativeAuthItem(legacyStorageKey, value);
      }
    } catch (error) {
      console.warn("[supabase] auth storage write failed", error);
    }
  },
  async removeItem(storageKey: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
      await removeNativeAuthItem(storageKey);
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        window.localStorage.removeItem(legacyStorageKey);
        await removeNativeAuthItem(legacyStorageKey);
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
