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
function getLegacyStorageKey() { try { if (!url) return null; const projectRef = new URL(url).hostname.split(".")[0]; return projectRef ? `sb-${projectRef}-auth-token` : null; } catch { return null; } }
const legacyStorageKey = getLegacyStorageKey();
function cookiePrefix(storageKey: string) { return `ja_${storageKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`; }
function getCookie(name: string) { if (typeof document === "undefined") return null; try { const encodedName = `${encodeURIComponent(name)}=`; const part = document.cookie.split("; ").find((row) => row.startsWith(encodedName)); return part ? decodeURIComponent(part.slice(encodedName.length)) : null; } catch { return null; } }
function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) { if (typeof document === "undefined") return; try { const secure = window.location.protocol === "https:" ? "; Secure" : ""; document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`; } catch {} }
function removeCookie(name: string) { setCookie(name, "", 0); }
function getCookieAuthItem(storageKey: string) { const prefix = cookiePrefix(storageKey); const chunkCount = Number(getCookie(`${prefix}_chunks`) ?? 0); if (chunkCount > 0 && chunkCount <= COOKIE_CHUNK_LIMIT) { let value = ""; for (let i = 0; i < chunkCount; i += 1) { const chunk = getCookie(`${prefix}_${i}`); if (chunk == null) return null; value += chunk; } return value || null; } return getCookie(prefix); }
function setCookieAuthItem(storageKey: string, value: string) { const prefix = cookiePrefix(storageKey); removeCookie(prefix); for (let i = 0; i < COOKIE_CHUNK_LIMIT; i += 1) removeCookie(`${prefix}_${i}`); const chunks = Math.ceil(value.length / COOKIE_CHUNK_SIZE); if (chunks <= 1) { removeCookie(`${prefix}_chunks`); setCookie(prefix, value); return; } if (chunks > COOKIE_CHUNK_LIMIT) return; setCookie(`${prefix}_chunks`, String(chunks)); for (let i = 0; i < chunks; i += 1) setCookie(`${prefix}_${i}`, value.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE)); }
function removeCookieAuthItem(storageKey: string) { const prefix = cookiePrefix(storageKey); removeCookie(prefix); removeCookie(`${prefix}_chunks`); for (let i = 0; i < COOKIE_CHUNK_LIMIT; i += 1) removeCookie(`${prefix}_${i}`); }
function getLocalAuthItem(storageKey: string) { if (typeof window === "undefined") return null; try { return window.localStorage.getItem(storageKey) ?? memoryAuthStorage.get(storageKey) ?? null; } catch { return memoryAuthStorage.get(storageKey) ?? null; } }
function setLocalAuthItem(storageKey: string, value: string) { memoryAuthStorage.set(storageKey, value); if (typeof window !== "undefined") try { window.localStorage.setItem(storageKey, value); } catch {} }
function removeLocalAuthItem(storageKey: string) { memoryAuthStorage.delete(storageKey); if (typeof window !== "undefined") try { window.localStorage.removeItem(storageKey); } catch {} }
function shouldUseNativeStorage() { try { return typeof window !== "undefined" && Capacitor.isNativePlatform(); } catch { return false; } }
async function getNativeAuthItem(storageKey: string) { if (!shouldUseNativeStorage()) return null; try { return (await Preferences.get({ key: storageKey })).value; } catch { return null; } }
async function setNativeAuthItem(storageKey: string, value: string) { if (!shouldUseNativeStorage()) return; try { await Preferences.set({ key: storageKey, value }); } catch {} }
async function removeNativeAuthItem(storageKey: string) { if (!shouldUseNativeStorage()) return; try { await Preferences.remove({ key: storageKey }); } catch {} }
const resilientAuthStorage = { async getItem(storageKey: string) { if (typeof window === "undefined") return null; const candidates = [getLocalAuthItem(storageKey), await getNativeAuthItem(storageKey), getCookieAuthItem(storageKey)]; if (storageKey === AUTH_STORAGE_KEY && legacyStorageKey) candidates.push(getLocalAuthItem(legacyStorageKey), await getNativeAuthItem(legacyStorageKey), getCookieAuthItem(legacyStorageKey)); const value = candidates.find(Boolean) ?? null; if (value) { setLocalAuthItem(storageKey, value); setCookieAuthItem(storageKey, value); void setNativeAuthItem(storageKey, value); } return value; }, async setItem(storageKey: string, value: string) { if (typeof window === "undefined") return; setLocalAuthItem(storageKey, value); setCookieAuthItem(storageKey, value); await setNativeAuthItem(storageKey, value); }, async removeItem(storageKey: string) { if (typeof window === "undefined") return; removeLocalAuthItem(storageKey); removeCookieAuthItem(storageKey); await removeNativeAuthItem(storageKey); } };
if (!url || !key) console.error("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Check .env");
const realSupabase = createClient(url ?? "", key ?? "", { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY, storage: resilientAuthStorage } });

const isStudioPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("adminPreview") === "1" && new URLSearchParams(window.location.search).get("previewIdentity") === "neutral";
const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&fit=crop";

function studioRows(table: string): any[] {
  const now = new Date().toISOString();
  const profiles = Array.from({ length: 8 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, username: `Demo User ${i + 1}`, full_name: `Demo User ${i + 1}`, avatar: MOCK_AVATAR, avatar_url: MOCK_AVATAR, level: 20 + i, xp: 2500 + i * 300, coins: 12500 + i * 1000, diamonds: 8500 + i * 500, is_vip: i < 3, vip_level: i < 3 ? 5 + i : 0, country: "Demo", status: "online", bio: "Studio preview profile", followers_count: 1200 + i * 500, following_count: 300 + i * 50 }));
  if (["profiles", "user_profiles", "public_profiles"].includes(table)) return profiles;
  if (["user_roles", "roles"].includes(table)) return [{ user_id: MOCK_USER_ID, role: "user" }];
  if (["rooms", "live_rooms"].includes(table)) return Array.from({ length: 6 }, (_, i) => ({ id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, name: `Demo Voice Room ${i + 1}`, title: `Demo Live Room ${i + 1}`, host_id: profiles[i].id, host: profiles[i], status: "live", room_type: i % 2 ? "video" : "voice", member_count: 4 + i, max_seats: 12, cover_url: "", created_at: now }));
  if (["room_members", "room_participants", "room_seats"].includes(table)) return profiles.slice(0, 6).map((p, i) => ({ id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, room_id: "10000000-0000-4000-8000-000000000001", user_id: p.id, profile: p, seat_number: i + 1, is_muted: false }));
  if (["gifts", "gift_catalog", "gift_items"].includes(table)) return ["Rose", "Heart", "Rocket", "Crown", "Diamond", "Castle"].map((name, i) => ({ id: `gift-${i + 1}`, name: `Demo ${name}`, title: `Demo ${name}`, price: (i + 1) * 100, coins: (i + 1) * 100, image_url: "", is_active: true, sort_order: i }));
  if (["notifications", "user_notifications"].includes(table)) return [{ id: "notice-1", title: "Welcome to Studio Preview", message: "Demo notification", read: false, created_at: now }, { id: "notice-2", title: "Demo Event", message: "Preview-only notification", read: true, created_at: now }];
  if (["messages", "conversations", "chats", "chat_messages"].includes(table)) return profiles.slice(0, 4).map((p, i) => ({ id: `msg-${i + 1}`, user_id: p.id, profile: p, sender_id: p.id, receiver_id: MOCK_USER_ID, content: ["Hello 👋", "Welcome", "Nice room!", "See you live"][i], message: ["Hello 👋", "Welcome", "Nice room!", "See you live"][i], created_at: now }));
  if (["followers", "following", "user_followers"].includes(table)) return profiles.slice(1, 6).map((p, i) => ({ id: `follow-${i + 1}`, follower_id: MOCK_USER_ID, following_id: p.id, profile: p, created_at: now }));
  if (["rankings", "leaderboard", "user_rankings"].includes(table)) return profiles.map((p, i) => ({ id: `rank-${i + 1}`, user_id: p.id, profile: p, rank: i + 1, score: 10000 - i * 700, points: 10000 - i * 700 }));
  if (["wallets", "wallet", "user_wallets", "balances"].includes(table)) return [{ id: "wallet-demo", user_id: MOCK_USER_ID, coins: 12500, diamonds: 8500, balance: 2500, currency: "PKR" }];
  if (["transactions", "wallet_transactions", "recharge_history", "withdrawals", "gift_history"].includes(table)) return Array.from({ length: 5 }, (_, i) => ({ id: `txn-${i + 1}`, user_id: MOCK_USER_ID, amount: (i + 1) * 500, coins: (i + 1) * 1000, diamonds: (i + 1) * 500, status: "completed", type: i % 2 ? "recharge" : "demo", created_at: now }));
  return [];
}

function createStudioQuery(table: string) {
  let rows = studioRows(table);
  const query: any = {
    select: () => query,
    eq: (column: string, value: any) => { rows = rows.filter((r) => r?.[column] === value || r?.[column]?.id === value); return query; },
    neq: (column: string, value: any) => { rows = rows.filter((r) => r?.[column] !== value); return query; },
    in: (column: string, values: any[]) => { rows = rows.filter((r) => values.includes(r?.[column])); return query; },
    ilike: () => query, like: () => query, or: () => query, and: () => query, order: () => query,
    limit: (n: number) => { rows = rows.slice(0, n); return query; }, range: (a: number, b: number) => { rows = rows.slice(a, b + 1); return query; },
    insert: () => query, update: () => query, upsert: () => query, delete: () => query,
    single: async () => ({ data: rows[0] ?? null, error: null }), maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: any) => any) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve),
    catch: (reject: (reason: any) => any) => Promise.resolve({ data: rows, error: null }).catch(reject),
  };
  return query;
}

const studioAuth = {
  getSession: async () => ({ data: { session: { access_token: "studio-preview", refresh_token: "studio-preview", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: MOCK_USER_ID, aud: "authenticated", role: "authenticated", email: "studio-preview@jalwa.local", app_metadata: {}, user_metadata: { username: "Demo User" }, created_at: new Date().toISOString() } } }, error: null }),
  getUser: async () => ({ data: { user: { id: MOCK_USER_ID, aud: "authenticated", role: "authenticated", email: "studio-preview@jalwa.local", app_metadata: {}, user_metadata: { username: "Demo User" }, created_at: new Date().toISOString() } }, error: null }),
  onAuthStateChange: (callback: any) => { queueMicrotask(() => callback("INITIAL_SESSION", null)); return { data: { subscription: { unsubscribe: () => {} } } }; },
  signOut: async () => ({ error: null }),
};
const studioProxy = new Proxy(realSupabase as any, { get(target, property) { if (property === "from") return (table: string) => createStudioQuery(table); if (property === "auth") return studioAuth; if (property === "rpc") return async () => ({ data: null, error: null }); if (property === "channel") return () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }), subscribe: () => ({ unsubscribe: () => {} }), unsubscribe: async () => "ok" }); if (property === "removeChannel") return async () => "ok"; if (property === "removeAllChannels") return async () => "ok"; if (property === "storage") return { from: () => ({ upload: async () => ({ data: null, error: null }), remove: async () => ({ data: null, error: null }), getPublicUrl: (path: string) => ({ data: { publicUrl: path } }), list: async () => ({ data: [], error: null }) }) }; return target[property as keyof typeof target]; } });
export const supabase: SupabaseClient = (isStudioPreview ? studioProxy : realSupabase) as SupabaseClient;
