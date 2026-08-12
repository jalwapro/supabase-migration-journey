import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/bebas-neue/400.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeBackground } from "../components/ThemeBackground";
import { ThemeChrome } from "../components/ThemeChrome";
import { PublishedCustomizationRuntime } from "../components/customization/PublishedCustomizationRuntime";
import { useWakeLock } from "../hooks/useWakeLock";
import { InstallPermissionGate } from "../components/InstallPermissionGate";
import { NotificationPopup } from "../components/NotificationPopup";
import { useGlobalRealtime } from "../hooks/useGlobalRealtime";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6"><Link to="/" className="glow-4d inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">Go home</Link></div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const navigate = useNavigate();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    let cancelled = false;
    const t1 = window.setTimeout(() => { if (cancelled) return; try { router.invalidate(); } catch {} try { reset(); } catch {} }, 50);
    const t2 = window.setTimeout(() => { if (cancelled) return; try { navigate({ to: "/", replace: true }); } catch {} try { reset(); } catch {} }, 800);
    return () => { cancelled = true; window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [error, router, navigate, reset]);
  return <div className="min-h-screen bg-background" aria-hidden />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a0d2e" },
      { title: "Jalwa — Live Voice & Video Party" },
      { name: "description", content: "Jalwa — CREATE · SHARE · SHINE. Live voice & video rooms, gifting, games and rewards." },
      { property: "og:title", content: "Jalwa — Live Voice & Video Party" },
      { property: "og:description", content: "Live voice & video rooms, gifting, games and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const themeInit = `(() => { try { var m = localStorage.getItem('jalwa_theme_mode'); if (m !== 'light' && m !== 'dark') m = 'dark'; var r = document.documentElement; r.classList.toggle('dark', m === 'dark'); r.classList.toggle('light', m === 'light'); r.style.colorScheme = m; } catch(_) {} })();`;
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head suppressHydrationWarning><HeadContent /><script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        <div className="app-frame-outer" suppressHydrationWarning><div className="app-frame" suppressHydrationWarning>{children}</div></div>
        <Scripts />
      </body>
    </html>
  );
}

const SPLASH_GAP_MS = 5 * 60 * 1000;
const SPLASH_TS_KEY = "jalwa_last_active_ts";
let splashShownThisLoad = false;
function readLastActive(): number { try { const v = localStorage.getItem(SPLASH_TS_KEY); return v ? parseInt(v, 10) || 0 : 0; } catch { return 0; } }
function touchActive() { try { localStorage.setItem(SPLASH_TS_KEY, String(Date.now())); } catch {} }

function SplashGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (typeof window === "undefined") return;
    touchActive();
    const interval = window.setInterval(touchActive, 30_000);
    const onHide = () => touchActive();
    const onVisibility = () => touchActive();
    window.addEventListener("pagehide", onHide); window.addEventListener("beforeunload", onHide); document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); window.removeEventListener("pagehide", onHide); window.removeEventListener("beforeunload", onHide); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/splash") { splashShownThisLoad = true; return; }
    if (splashShownThisLoad) return;
    splashShownThisLoad = true;
    const last = readLastActive();
    if (last === 0 || Date.now() - last > SPLASH_GAP_MS) navigate({ to: "/splash", replace: true });
    touchActive();
  }, [pathname, navigate]);
  return null;
}

function GlobalRealtimeBridge() { useGlobalRealtime(); return <NotificationPopup />; }

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useWakeLock();
  const [toastTheme, setToastTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  });
  useEffect(() => { void import("../lib/native").then((m) => m.initNativeShell()); }, []);
  useEffect(() => {
    const onChange = (e: Event) => { const d = (e as CustomEvent<"light" | "dark">).detail; if (d === "light" || d === "dark") setToastTheme(d); };
    window.addEventListener("jalwa:theme-mode", onChange);
    return () => window.removeEventListener("jalwa:theme-mode", onChange);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeBackground />
        <ThemeChrome />
        <SplashGate />
        <InstallPermissionGate />
        <GlobalRealtimeBridge />
        <PublishedCustomizationRuntime />
        <div className="relative z-10" suppressHydrationWarning><Outlet /></div>
        <Toaster position="top-center" theme={toastTheme} richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
