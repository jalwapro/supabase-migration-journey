export const ADMIN_ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  "/admin": "dashboard.view",
  "/admin/roles": "roles.manage",
  "/admin/factory-reset": "factory_reset",
  "/admin/vm-server": "system.manage",
  "/admin/integrations": "integrations.manage",
  "/admin/connection": "system.manage",
  "/admin/settings": "system.manage",
  "/admin/payment-accounts": "payment_accounts.manage",
  "/admin/coins": "coin_sellers.manage",
  "/admin/coin-sellers": "audit.view",
  "/admin/recharge": "recharge.review",
  "/admin/withdrawals": "withdrawals.review",
  "/admin/finance-reports": "finance.reports",
  "/admin/free-accounts": "system.manage",
  "/admin/partners": "system.manage",
  "/admin/users": ["users.view", "users.lookup"],
  "/admin/rooms": "rooms.view",
  "/admin/live": "rooms.view",
  "/admin/rankings": "rankings.view",
  "/admin/reports": "reports.manage",
  "/admin/support": "support.manage",
  "/admin/notifications": "notifications.manage",
  "/admin/push": "notifications.manage",
  "/admin/logs": "audit.view",
  "/admin/frames": "visuals.manage",
  "/admin/gifts": "visuals.manage",
  "/admin/entrance-studio": "visuals.manage",
  "/admin/app-customization": "visuals.manage",
  "/admin/app-studio-live-rooms": "visuals.manage",
  "/admin/app-studio-assets": "visuals.manage",
  "/admin/app-studio-tokens": "visuals.manage",
  "/admin/room-backgrounds": "visuals.manage",
  "/admin/minigames": "content.manage",
  "/admin/room-games": "content.manage",
  "/admin/ludo-replays": "content.manage",
  "/admin/emojis": "visuals.manage",
  "/admin/entrances": "visuals.manage",
  "/admin/spotlights": "visuals.manage",
  "/admin/ads": "content.manage",
  "/admin/banners": "content.manage",
  "/admin/room-slides": "content.manage",
  "/admin/cms": "content.manage",
  "/admin/splash": "system.manage",
  "/admin/apk": "system.manage",
  "/admin/spin-prizes": "content.manage",
};

export function permissionForAdminPath(pathname: string): string | string[] {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const exact = ADMIN_ROUTE_PERMISSIONS[normalized];
  if (exact) return exact;
  const match = Object.keys(ADMIN_ROUTE_PERMISSIONS)
    .filter((path) => path !== "/admin" && normalized.startsWith(path + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ADMIN_ROUTE_PERMISSIONS[match] : "system.manage";
}

export function canAccessAdminPath(pathname: string, permissions: string[]): boolean {
  const required = permissionForAdminPath(pathname);
  return Array.isArray(required) ? required.some((permission) => permissions.includes(permission)) : permissions.includes(required);
}
