const CACHE_NAME = "jalwa-assets-v1";
const META_DB = "jalwa-asset-cache";
const META_STORE = "assets";
const MAX_CONCURRENCY = 2;
const BACKGROUND_CONCURRENCY = 1;

export type AssetManifestItem = {
  id: string;
  url: string;
  version: string;
  type: "image" | "video" | "audio" | "other";
  priority: number;
};

export type AssetCacheProgress = {
  status: "idle" | "checking" | "downloading" | "ready" | "offline" | "error";
  total: number;
  completed: number;
  downloadedBytes: number;
  totalBytes: number;
  currentAsset: string | null;
  percent: number;
};

type Meta = AssetManifestItem & { size?: number; sha256?: string; cachedAt: number };

const isBrowser = () => typeof window !== "undefined" && typeof caches !== "undefined";
const normalize = (url: string) => {
  try { return new URL(url, window.location.origin).toString(); } catch { return url; }
};

let progress: AssetCacheProgress = {
  status: "idle", total: 0, completed: 0, downloadedBytes: 0, totalBytes: 0,
  currentAsset: null, percent: 0,
};

const listeners = new Set<(value: AssetCacheProgress) => void>();

function publish(patch: Partial<AssetCacheProgress>) {
  progress = { ...progress, ...patch };
  for (const listener of listeners) listener(progress);
}

export function getAssetCacheProgress() { return progress; }

export function subscribeAssetCacheProgress(listener: (value: AssetCacheProgress) => void) {
  listeners.add(listener);
  listener(progress);
  return () => { listeners.delete(listener); };
}

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
  } catch { return false; }
}

export async function fetchAssetManifest(): Promise<AssetManifestItem[]> {
  try {
    const res = await fetch("/api/public/asset-manifest", { cache: "default" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.assets) ? data.assets : [];
  } catch { return []; }
}

export async function cacheAsset(
  item: AssetManifestItem,
  onComplete?: (item: AssetManifestItem, downloadedBytes: number) => void
): Promise<boolean> {
  if (!isBrowser() || !item?.url) return false;
  const url = normalize(item.url);
  publish({ status: "downloading", currentAsset: item.url });

  try {
    const cache = await caches.open(CACHE_NAME);
    const meta = await getMeta(url);

    // Version is the source of truth: unchanged assets are reused locally,
    // changed assets are downloaded once and replace the old local copy.
    if (meta?.version === item.version && await cache.match(url)) {
      onComplete?.(item, 0);
      return true;
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      onComplete?.(item, 0);
      return false;
    }

    const size = Number(response.headers.get("content-length") || 0) || undefined;
    const digest = await sha256(response);
    await cache.put(url, response.clone());
    await putMeta({ ...item, url, size, sha256: digest, cachedAt: Date.now() });
    onComplete?.(item, size ?? 0);
    return true;
  } catch {
    onComplete?.(item, 0);
    return false;
  }
}

export async function warmAssetManifest(assets: AssetManifestItem[], concurrency = MAX_CONCURRENCY) {
  // Every catalogued asset is now part of the local-first pack:
  // gifts, frames, entrances, backgrounds, themes, ranking/profile frames,
  // animations and audio. Priority controls download order, not eligibility.
  const ordered = [...assets].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  if (!ordered.length) {
    publish({ status: "ready", total: 0, completed: 0, percent: 100, currentAsset: null });
    return;
  }

  publish({
    status: "checking",
    total: ordered.length,
    completed: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    currentAsset: null,
    percent: 0,
  });

  let cursor = 0;
  let completed = 0;
  let downloadedBytes = 0;

  const worker = async () => {
    while (cursor < ordered.length) {
      const item = ordered[cursor++];
      const ok = await cacheAsset(item, (_item, bytes) => {
        completed += 1;
        downloadedBytes += bytes;
        publish({
          status: "downloading",
          completed,
          downloadedBytes,
          percent: Math.round((completed / ordered.length) * 100),
          currentAsset: completed < ordered.length ? item.url : null,
        });
      });
      if (!ok && !navigator.onLine) publish({ status: "offline" });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, ordered.length) }, worker));
  publish({
    status: navigator.onLine ? "ready" : "offline",
    completed,
    percent: Math.round((completed / ordered.length) * 100),
    currentAsset: null,
  });
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
  publish({ status: "checking" });
  await registerAssetCacheWorker();
  try { await navigator.storage?.persist?.(); } catch {}

  const assets = await fetchAssetManifest();
  if (!assets.length) {
    publish({ status: navigator.onLine ? "ready" : "offline", percent: 100 });
    return;
  }

  // Keep launch work limited to small, high-priority images. Everything else
  // is cached transparently on first real use by the service worker. Do not
  // start a hidden full-catalog download after launch: that competes with
  // Supabase, navigation, taps, popups and room rendering for bandwidth/CPU.
  const startupAssets = assets.filter((item) => item.type === "image" && item.priority >= 70);

  void warmAssetManifest(startupAssets, MAX_CONCURRENCY);
}
