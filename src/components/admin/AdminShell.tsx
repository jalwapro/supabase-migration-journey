import { Link, useRouterState } from "@tanstack/react-router";
import { type LucideIcon, LayoutDashboard, Users, DoorOpen, Image as ImageIcon, Radio, Trophy, Coins, Store, Wallet, CreditCard, ArrowUpFromLine, Handshake, Gift as GiftIcon, Megaphone, GalleryHorizontal, FileText, LifeBuoy, Flag, ScrollText, Sparkles, Plug, Settings, ShieldCheck, Palette, FolderTree, Crown, UserCog, LogOut, BarChart3, PiggyBank, UserPlus, Bell, ImagePlus, Download, Dices, Database, Trash2, Wand2, Server } from "lucide-react";
import type { ReactNode } from "react";
import { AdminNotificationsBell } from "@/components/admin/AdminNotificationsBell";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdminPath } from "@/lib/admin-permissions";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Users & Rooms", items: [{ to: "/admin/users", label: "Users", icon: Users }, { to: "/admin/rooms", label: "Rooms", icon: DoorOpen }, { to: "/admin/room-backgrounds", label: "Room Backgrounds", icon: ImageIcon }, { to: "/admin/live", label: "Live Management", icon: Radio }, { to: "/admin/rankings", label: "Rankings", icon: Trophy }] },
  { label: "Finance", items: [{ to: "/admin/coins", label: "Coin Management", icon: Coins }, { to: "/admin/coin-sellers", label: "Coin Seller Marketplace", icon: Store }, { to: "/admin/recharge", label: "Recharge", icon: Wallet }, { to: "/admin/payment-accounts", label: "Payment Accounts", icon: CreditCard }, { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine }, { to: "/admin/partners", label: "Partners", icon: Handshake }, { to: "/admin/free-accounts", label: "Free Accounts", icon: UserPlus }, { to: "/admin/finance-reports", label: "Finance Reports", icon: PiggyBank }] },
  { label: "Design & Media", items: [{ to: "/admin/frames", label: "Visuals & VIP Hub", icon: Crown }, { to: "/admin/gifts", label: "Gifts & Shop Media Hub", icon: GiftIcon }, { to: "/admin/entrance-studio", label: "Entrance Studio", icon: Wand2 }, { to: "/admin/app-customization", label: "App Studio", icon: Wand2 }, { to: "/admin/app-studio-live-rooms", label: "Live Rooms Designer", icon: Radio }, { to: "/admin/app-studio-assets", label: "App Studio — Assets & Fonts", icon: ImagePlus }, { to: "/admin/app-studio-tokens", label: "App Studio — Global Tokens", icon: Palette }, { to: "/admin/minigames", label: "Mini Games", icon: Dices }, { to: "/admin/room-games", label: "Room Games", icon: Dices }, { to: "/admin/ludo-replays", label: "Ludo Replays", icon: Dices }, { to: "/admin/emojis", label: "Emoji Management", icon: Sparkles }, { to: "/admin/entrances", label: "Entrance Effects", icon: Sparkles }, { to: "/admin/spotlights", label: "Profile Spotlights", icon: Crown }, { to: "/admin/ads", label: "Ads Management", icon: Megaphone }, { to: "/admin/banners", label: "Home Banners", icon: GalleryHorizontal }, { to: "/admin/room-slides", label: "Room Slides", icon: GalleryHorizontal }, { to: "/admin/cms", label: "CMS / Content", icon: FileText }] },
  { label: "Support & Operations", items: [{ to: "/admin/support", label: "Support & Helpdesk", icon: LifeBuoy }, { to: "/admin/notifications", label: "Notifications", icon: Bell }, { to: "/admin/push", label: "Push Diagnostics", icon: Bell }, { to: "/admin/reports", label: "Report Center", icon: Flag }, { to: "/admin/logs", label: "Admin Logs", icon: ScrollText }] },
  { label: "System", items: [{ to: "/admin/vm-server", label: "VM Server", icon: Server }, { to: "/admin/splash", label: "Splash & Animation", icon: Sparkles }, { to: "/admin/apk", label: "APK Download", icon: Download }, { to: "/admin/integrations", label: "Integrations", icon: Plug }, { to: "/admin/connection", label: "Connection Status", icon: Database }, { to: "/admin/settings", label: "Settings", icon: Settings }, { to: "/admin/roles", label: "Admin Roles", icon: ShieldCheck }, { to: "/admin/spin-prizes", label: "Daily Spin", icon: Dices }] },
  { label: "Developer Tools", items: [{ to: "/admin/factory-reset", label: "Factory Reset", icon: Trash2 }] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { adminPermissions } = useAuth();
  const visibleNav = ADMIN_NAV
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessAdminPath(item.to, adminPermissions)) }))
    .filter((group) => group.items.length > 0);

  return <div className="admin-fullscreen flex min-h-screen w-full bg-background text-foreground">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-card/40 md:block lg:w-72">
      <div className="p-4"><Link to="/admin" className="flex items-center gap-2"><div className="glow-4d grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BarChart3 className="h-4 w-4" /></div><div><p className="text-sm font-bold leading-none">Admin Panel</p><p className="mt-0.5 text-[10px] text-muted-foreground">Jalwa Console</p></div></Link></div>
      <nav className="px-2 pb-4">{visibleNav.map((group) => <div key={group.label} className="mb-4"><p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</p><ul className="space-y-0.5">{group.items.map((item) => { const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to); return <li key={item.to}><Link to={item.to} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "emboss-nav-active font-semibold text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}><item.icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span></Link></li>; })}</ul></div>)}<Link to="/" className="mx-2 mt-2 flex items-center gap-2 rounded-lg emboss px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Exit to App</Link></nav>
    </aside>
    <main className="min-w-0 flex-1">{adminPermissions.includes("notifications.manage") && <AdminNotificationsBell />}<MobileNav pathname={pathname} groups={visibleNav} /><div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</div></main>
  </div>;
}

function MobileNav({ pathname, groups }: { pathname: string; groups: NavGroup[] }) {
  return <div className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden">{groups.flatMap((group) => group.items).map((item) => { const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to); return <Link key={item.to} to={item.to} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</Link>; })}</div>;
}

export function AdminPageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold md:text-2xl">{title}</h1>{subtitle && <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>}</div>{right}</div>;
}
