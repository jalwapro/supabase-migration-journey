import type { Session, User } from "@supabase/supabase-js";

/**
 * Hard boundary for the App Customization Studio iframe.
 * Admin authentication is intentionally separate from the identity rendered by
 * the real app components inside the Studio preview.
 */
export const isStudioPreview = (): boolean => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("adminPreview") === "1" && params.get("previewIdentity") === "neutral";
};

export const STUDIO_PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000001";
export const STUDIO_PREVIEW_EMAIL = "studio-preview@jalwa.local";

export const STUDIO_PREVIEW_USER = {
  id: STUDIO_PREVIEW_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: STUDIO_PREVIEW_EMAIL,
  app_metadata: {},
  user_metadata: { username: "Demo User" },
  created_at: "2026-01-01T00:00:00.000Z",
} as unknown as User;

export const STUDIO_PREVIEW_SESSION = {
  access_token: "studio-preview-access-token",
  refresh_token: "studio-preview-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: STUDIO_PREVIEW_USER,
} as unknown as Session;

/** Shape mirrors the app's Profile type without importing useAuth (avoids a cycle). */
export const STUDIO_PREVIEW_PROFILE = {
  id: STUDIO_PREVIEW_USER_ID,
  username: "Demo User",
  full_name: "Demo User",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&fit=crop",
  frame: null,
  ring: null,
  bubble: null,
  car: null,
  entrance: null,
  special_id: null,
  data_card: null,
  bio: "Studio preview profile",
  gender: "other",
  country: "Demo",
  coins: 12500,
  diamonds: 8500,
  level: 25,
  xp: 5000,
  is_vip: true,
  vip_expiry: null,
  vip_level: 5,
  status: "online",
  theme_id: null,
  frame_expires_at: null,
  is_free: false,
  user_code: "DEMO25",
  last_seen: "2026-01-01T00:00:00.000Z",
};

/**
 * Used by preview-only fetch guards. Production APIs are never a fallback.
 */
export const STUDIO_PREVIEW_QUERY_PARAM = "adminPreview=1&previewIdentity=neutral";
