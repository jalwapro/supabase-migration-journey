import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const AUTH_STORAGE_KEY = "jalwa-auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COOKIE_CHUNK_SIZE = 3000;
const COOKIE_CHUNK_LIMIT = 8;
const memoryAuthStorage = new Map<string, string>();

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

function cookiePrefix(storageKey: string) {
  return `ja_${storageKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  try {
    const encodedName = `${encodeURIComponent(name)}=`;
    const part = document.cookie
      .split("; ")
      .find((row) => row.startsWith(encodedName));
    if (!part) return null;
    return decodeURIComponent(part.slice(encodedName.length));
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === "undefined") return;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
      value,
    )}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookie fallback unavailable */
  }
}

function removeCookie(name: string) {
  setCookie(name, "", 0);
}

function getCookieAuthItem(storageKey: string) {
  const prefix = cookiePrefix(storageKey);
  const chunkCount = Number(getCookie(`${prefix}_chunks`) ?? 0);
  if (chunkCount > 0 && chunkCount <= COOKIE_CHUNK_LIMIT) {
    let value = "";
    for (let i = 0; i < chunkCount; i += 1) {
      const chunk = getCookie(`${prefix}_${i}`);
      if (chunk == null) return null;
      value += chunk;
    }
    return value || null;
  }
  return getCookie(prefix);
}

function setCookieAuthItem(storageKey: string, value: string) {
  const prefix = cookiePrefix(storageKey);
  removeCookie(prefix);
  for (let i = 0; i < COOKIE_CHUNK_LIMIT; i += 1) removeCookie(`${prefix}_${i}`);

  const chunks = Math.ceil(value.length / COOKIE_CHUNK_SIZE);
  if (chunks <= 1) {
    removeCookie(`${prefix}_chunks`);
    setCookie(prefix, value);
    return;
  }

  if (chunks > COOKIE_CHUNK_LIMIT) {
    removeCookie(`${prefix}_chunks`);
    return;
  }

  setCookie(`${prefix}_chunks`, String(chunks));
  for (let i = 0; i < chunks; i += 1) {
    setCookie(`${prefix}_${i}`, value.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE));
  }
}

function removeCookieAuthItem(storageKey: string) {
  const prefix = cookiePrefix(storageKey);
  removeCookie(prefix);
  removeCookie(`${prefix}_chunks`);
  for (let i = 0; i < COOKIE_CHUNK_LIMIT; i += 1) removeCookie(`${prefix}_${i}`);
}

function getLocalAuthItem(storageKey: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey) ?? memoryAuthStorage.get(storageKey) ?? null;
  } catch {
    return memoryAuthStorage.get(storageKey) ?? null;
  }
}

function setLocalAuthItem(storageKey: string, value: string) {
  memoryAuthStorage.set(storageKey, value);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, value);
  } catch (error) {
    console.warn("[supabase] local auth storage write failed", error);
  }
}

function removeLocalAuthItem(storageKey: string) {
  memoryAuthStorage.delete(storageKey);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("[supabase] local auth storage remove failed", error);
  }
}

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
    const candidates = [
      getLocalAuthItem(storageKey),
      await getNativeAuthItem(storageKey),
      getCookieAuthItem(storageKey),
    ];

    // Earlier builds used Supabase's default key. Keep reading it so users
    // are not asked to sign in again after the app switched to jalwa-auth.
    if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
      candidates.push(
        getLocalAuthItem(legacyStorageKey),
        await getNativeAuthItem(legacyStorageKey),
        getCookieAuthItem(legacyStorageKey),
      );
    }

    const value = candidates.find(Boolean) ?? null;
    if (value) {
      setLocalAuthItem(storageKey, value);
      setCookieAuthItem(storageKey, value);
      void setNativeAuthItem(storageKey, value);
      if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
        setLocalAuthItem(legacyStorageKey, value);
        setCookieAuthItem(legacyStorageKey, value);
        void setNativeAuthItem(legacyStorageKey, value);
      }
    }
    return value;
  },
  async setItem(storageKey: string, value: string) {
    if (typeof window === "undefined") return;
    setLocalAuthItem(storageKey, value);
    setCookieAuthItem(storageKey, value);
    await setNativeAuthItem(storageKey, value);
    if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
      setLocalAuthItem(legacyStorageKey, value);
      setCookieAuthItem(legacyStorageKey, value);
      await setNativeAuthItem(legacyStorageKey, value);
    }
  },
  async removeItem(storageKey: string) {
    if (typeof window === "undefined") return;
    removeLocalAuthItem(storageKey);
    removeCookieAuthItem(storageKey);
    await removeNativeAuthItem(storageKey);
    if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) {
      removeLocalAuthItem(legacyStorageKey);
      removeCookieAuthItem(legacyStorageKey);
      await removeNativeAuthItem(legacyStorageKey);
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
