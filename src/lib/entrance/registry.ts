import { createClient } from "@supabase/supabase-js";

export type EntranceEffect = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  media_url: string;
  media_type: "mp4" | "webm" | "lottie" | "svga" | "svg";
  thumbnail_url: string | null;
  sound_url: string | null;
  chromakey: "none" | "green" | "black" | "luma";
  duration_ms: number;
  price_coins: number;
  min_vip_level: number;
  is_active: boolean;
  is_limited: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export type UserEntrance = {
  id: string;
  user_id: string;
  effect_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_equipped: boolean;
};

export type RoomEntranceEvent = {
  id: string;
  room_id: string;
  user_id: string;
  effect_id: string | null;
  effect_key: string | null;
  media_url: string | null;
  media_type: string | null;
  chromakey: string | null;
  sound_url: string | null;
  duration_ms: number | null;
  render_config?: unknown;
  username: string | null;
  avatar_url: string | null;
  vip_level: number | null;
  country: string | null;
  created_at: string;
};

export function preloadEntrance(url: string | null | undefined) {
  if (!url || url.startsWith("builtin:")) return;
  const t = document.createElement(url.endsWith(".mp4") || url.endsWith(".webm") ? "video" : "img");
  (t as HTMLImageElement).src = url;
  t.style.display = "none";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 8000);
}

export function shouldSkipHeavyEffects(): boolean {
  const conn = (navigator as any)?.connection;
  const t = conn?.effectiveType as string | undefined;
  return t === "slow-2g" || t === "2g";
}
