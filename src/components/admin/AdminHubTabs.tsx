import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Tab = { to: string; label: string; aliases?: string[] };

export function AdminHubTabs({
  title,
  tabs,
  children,
}: {
  title: string;
  tabs: Tab[];
  children?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-black md:text-2xl">{title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Unified admin workspace — related tools stay together.</p>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card/40 p-1.5">
        {tabs.map((tab) => {
          const active = pathname === tab.to || (tab.aliases ?? []).some((p) => pathname.startsWith(p));
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}

export const VISUALS_VIP_TABS: Tab[] = [
  { to: "/admin/frames", label: "DP Frames" },
  { to: "/admin/room-frames", label: "Room Frames", aliases: ["/admin/room-frames-preview"] },
  { to: "/admin/profile-cards", label: "Profile Cards" },
  { to: "/admin/themes", label: "Themes", aliases: ["/admin/custom-themes", "/admin/theme-categories"] },
  { to: "/admin/vip", label: "VIP Config", aliases: ["/admin/vip-levels", "/admin/assign-frame"] },
];

export const GIFT_HUB_TABS: Tab[] = [
  { to: "/admin/gifts", label: "Gifts" },
  { to: "/admin/gift-studio", label: "Gift Studio" },
  { to: "/admin/gift-batches", label: "Batches" },
  { to: "/admin/shop-studio", label: "Shop Render" },
];

export const SUPPORT_HUB_TABS: Tab[] = [
  { to: "/admin/support", label: "Tickets" },
  { to: "/admin/support-chat", label: "Live Chat" },
  { to: "/admin/support-room", label: "24/7 Room" },
];
