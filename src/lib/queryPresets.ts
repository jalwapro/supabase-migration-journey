// Shared TanStack Query cache presets. Import these instead of scattering
// magic numbers so realtime-backed views and static/admin reads use
// consistent freshness windows.
import type { UseQueryOptions } from "@tanstack/react-query";

export const STALE = {
  /** Data that changes every few seconds and is NOT covered by realtime. */
  LIVE: 5_000,
  /** Realtime-backed lists — realtime invalidates, this just guards focus. */
  REALTIME: 30_000,
  /** User/profile-ish data that rarely changes mid-session. */
  PROFILE: 60_000,
  /** Reference data (categories, VIP tiers, gift catalog). */
  STATIC: 5 * 60_000,
} as const;

export const GC = {
  SHORT: 60_000,
  DEFAULT: 5 * 60_000,
  LONG: 30 * 60_000,
} as const;

/**
 * Retry policy that avoids hammering the backend on client errors (401/403/
 * 404/409 will not benefit from a retry). Network / 5xx get one retry.
 */
export function smartRetry(failureCount: number, error: unknown): boolean {
  const status =
    (error as { status?: number })?.status ??
    (error as { statusCode?: number })?.statusCode ??
    (error as { response?: { status?: number } })?.response?.status ??
    0;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const realtimeQueryDefaults: Partial<UseQueryOptions> = {
  staleTime: STALE.REALTIME,
  gcTime: GC.DEFAULT,
  refetchOnWindowFocus: false,
};
