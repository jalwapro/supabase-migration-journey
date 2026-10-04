const CACHE_NAME = "jalwa-assets-v1";
const META_DB = "jalwa-asset-cache";
const META_STORE = "assets";
const MAX_CONCURRENCY = 2;

export type AssetManifestItem = {
  id: string;
  url: string;
  version: string;
  type: "image" | "video" | "audio" | "other";
  priority: number;
};

type Meta = AssetManifestItem & { size?: number; sha256?: string; cachedAt: number };

const isBrowser = () => typeof window !== "undefined" && typeof caches !== "undefined";
const normalize = (url: string) => {
  try { return new URL(url, window.location.origin).toString(); } catch { return url; }
};

function openMetaDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    const req = indexedDB.open(META_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "url" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function putMeta(meta: Meta) {
  const db = await openMetaDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function getMeta(url: string): Promise<Meta | null> {
  const db = await openMetaDb();
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get(url);
    req.onsuccess = () => resolve((req.result as Meta | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function sha256(response: Response) {
  try {
    const buffer = await response.clone().arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return undefined; }
}

export async function registerAssetCacheWorker() {
  if (!isBrowser() || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/asset-cache-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return true;
  } catch {
    return false;
  }
}

export async function fetchAssetManifest(): Promise<AssetManifestItem[]> {
  try {
    const res = await fetch("/api/public/asset-manifest", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.assets) ? data.assets : [];
  } catch { return []; }
}

export async function cacheAsset(item: AssetManifestItem): Promise<boolean> {
  if (!isBrowser() || !item?.url) return false;
  const url = normalize(item.url);
  try {
    const cache = await caches.open(CACHE_NAME);
    const meta = await getMeta(url);
    if (meta?.version === item.version && await cache.match(url)) return true;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return false;
    const digest = await sha256(response);
    await cache.put(url, response.clone());
    const size = Number(response.headers.get("content-length") || 0) || undefined;
    await putMeta({ ...item, url, size, sha256: digest, cachedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

export async function warmAssetManifest(assets: AssetManifestItem[]) {
  const ordered = [...assets].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  let cursor = 0;
  const worker = async () => {
    while (cursor < ordered.length) {
      const item = ordered[cursor++];
      await cacheAsset(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, ordered.length) }, worker));
}

export async function getCachedAsset(url: string): Promise<string | null> {
  if (!isBrowser()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(normalize(url));
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch { return null; }
}

export async function clearJalwaAssetCache() {
  if (!isBrowser()) return;
  await caches.delete(CACHE_NAME);
  const db = await openMetaDb();
  if (db) db.close();
}

export async function initJalwaAssetCache() {
  if (!isBrowser()) return;
  await registerAssetCacheWorker();
  try { await navigator.storage?.persist?.(); } catch {}
  const assets = await fetchAssetManifest();
  if (!assets.length) return;
  void warmAssetManifest(assets);
}
