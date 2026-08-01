// Signed-URL helpers for private storage buckets (chat-media, voice-notes,
// recharge-proofs). New uploads store a `storage://<bucket>/<path>` marker in
// place of a public URL; legacy rows that still contain the raw public URL are
// parsed for their bucket/path so signing works transparently.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRIVATE_BUCKETS = new Set(["chat-media", "voice-notes", "recharge-proofs"]);
const SIGN_TTL_SECONDS = 60 * 60; // 1h — refreshed lazily via cache.

export type StorageRef = { bucket: string; path: string };

export function parseStorageRef(input: string | null | undefined): StorageRef | null {
  if (!input) return null;
  const marker = input.match(/^storage:\/\/([^/]+)\/(.+)$/);
  if (marker) return { bucket: marker[1], path: marker[2] };
  const pub = input.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (pub) return { bucket: pub[1], path: decodeURIComponent(pub[2]) };
  return null;
}

export function isPrivateStorageInput(input: string | null | undefined): boolean {
  const ref = parseStorageRef(input);
  return !!ref && PRIVATE_BUCKETS.has(ref.bucket);
}

const cache = new Map<string, { url: string; exp: number }>();

export async function resolveMediaUrl(input: string | null | undefined): Promise<string> {
  if (!input) return "";
  const ref = parseStorageRef(input);
  if (!ref || !PRIVATE_BUCKETS.has(ref.bucket)) {
    return input.startsWith("storage://") ? "" : input;
  }
  const key = `${ref.bucket}/${ref.path}`;
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(key);
  if (hit && hit.exp - 60 > now) return hit.url;

  // Primary: Cloudflare R2 (all media lives there now) via a short-lived
  // presigned GET. Falls back to Supabase storage for anything not migrated.
  const r2 = await signR2Get(key);
  if (r2) {
    cache.set(key, { url: r2, exp: now + SIGN_TTL_SECONDS });
    return r2;
  }

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return "";
  cache.set(key, { url: data.signedUrl, exp: now + SIGN_TTL_SECONDS });
  return data.signedUrl;
}

let r2ReadAvailable: boolean | null = null;

async function signR2Get(key: string): Promise<string | null> {
  if (r2ReadAvailable === false) return null;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/r2-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ op: "get", path: key }),
    });
    if (!res.ok) {
      if (res.status === 503) r2ReadAvailable = false;
      return null;
    }
    const out = (await res.json()) as { url?: string };
    if (!out?.url) return null;
    // Verify the object actually exists in R2 before handing it to <audio>.
    const head = await fetch(out.url, { method: "HEAD" });
    if (!head.ok) return null;
    r2ReadAvailable = true;
    return out.url;
  } catch {
    return null;
  }
}


export function useSignedMediaUrl(input: string | null | undefined): string {
  const [url, setUrl] = useState<string>(() => {
    if (!input) return "";
    if (input.startsWith("storage://")) return "";
    return isPrivateStorageInput(input) ? "" : input;
  });
  useEffect(() => {
    let cancelled = false;
    resolveMediaUrl(input).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [input]);
  return url;
}
