import type { Session, User } from "@supabase/supabase-js";

const STUDIO_WINDOW_NAME = "jalwa-studio-preview";

/**
 * Preview mode is scoped to the browser window that hosts the Studio iframe.
 * We intentionally do NOT use sessionStorage/localStorage because the Studio
 * iframe is same-origin and those stores can be shared with the Admin page.
 */
export const isStudioPreview = (): boolean => {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const explicitPreview =
    params.get("adminPreview") === "1" &&
    params.get("previewIdentity") === "neutral";
  const designIframe =
    window.parent !== window && params.get("customizationMode") === "design";
  const markedPreviewWindow = window.name === STUDIO_WINDOW_NAME;

  if (explicitPreview || designIframe) {
    // Persist the preview boundary across TanStack Router redirects inside
    // this iframe without affecting the parent Admin Panel window.
    try { window.name = STUDIO_WINDOW_NAME; } catch {}
    return true;
  }

  return markedPreviewWindow;
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

export const STUDIO_PREVIEW_PROFILE = {
  id: STUDIO_PREVIEW_USER_ID,
  username: "Demo User",
  full_name: "Demo User",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&fit=crop",
  frame: null, ring: null, bubble: null, car: null, entrance: null, special_id: null, data_card: null,
  bio: "Studio preview profile", gender: "other", country: "Demo", coins: 12500, diamonds: 8500,
  level: 25, xp: 5000, is_vip: true, vip_expiry: null, vip_level: 5, status: "online", theme_id: null,
  frame_expires_at: null, is_free: false, user_code: "DEMO25", last_seen: "2026-01-01T00:00:00.000Z",
};

export const STUDIO_PREVIEW_QUERY_PARAM = "adminPreview=1&customizationMode=design&previewIdentity=neutral";
