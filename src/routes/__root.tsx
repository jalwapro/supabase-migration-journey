import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/bebas-neue/400.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouterState, useNavigate, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import "../voice-room-reference.css";
import "../voice-room-mobile.css";
import "../voice-room-mobile-final.css";
import "../voice-room-mobile-components.css";
import "../voice-room-mobile-content.css";
import "../room-rank-frame-alignment.css";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeChrome } from "../components/ThemeChrome";
import { useWakeLock } from "../hooks/useWakeLock";
import { NotificationPopup } from "../components/NotificationPopup";
import { useGlobalRealtime } from "../hooks/useGlobalRealtime";
import { StudioLayer } from "../components/studio/StudioLayer";
import { LaunchRouteGate } from "../components/LaunchRouteGate";
import { applyGlobalTokens, loadPublishedGlobalTokens } from "../lib/app-customization/global-tokens";
import { applyCurrentPublishedConfig } from "../lib/app-customization/published-runtime";
import { VoiceRoomSessionProvider, useVoiceRoomSession } from "../context/VoiceRoomSessionContext";
import { GlobalMinimizedVoiceRoom } from "../components/voice-room/GlobalMinimizedVoiceRoom";
import { InstallPermissionGate } from "../components/InstallPermissionGate";
function NotFoundComponent() { return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-gradient">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you’re looking for doesn’t exist or has been moved.</p><div className="mt-6"><Link to="/" className="glow-4d inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">Go home</Link></div></div></div> }
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) { console.error(error); useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]); return <div className="flex min-h-screen items-center justify-center bg-[#08050c] px-5 text-white"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Jalwa</div><h1 className="text-xl font-bold">The current screen could not be rendered</h1><p className="mt-2 text-sm text-white/60">The application caught an error instead of showing a blank screen. Your live-room functionality has not been replaced.</p><pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-red-200 whitespace-pre-wrap">{error?.message || String(error)}</pre><div className="mt-4 flex gap-2"><button type="button" onClick={() => reset()} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Retry</button><Link to="/" className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">Home</Link></div></div></div> }
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({ head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }, { name: "theme-color", content: "#1a0d2e" }, { title: "Jalwa — Live Voice & Video Party" }, { name: "description", content: "Jalwa — CREATE · SHARE · SHINE. Live voice & video rooms, gifting, games and rewards." }, { property: "og:title", content: "Jalwa — Live Voice & Video Party" }, { property: "og:description", content: "Live voice & video rooms, gifting, games and rewards." }, { property: "og:type", content: "website" }], links: [{ rel: "stylesheet", href: appCss }, { rel: "manifest", href: "/manifest.webmanifest" }, { rel: "icon", href: "/favicon.png", type: "image/png" }, { rel: "apple-touch-icon", href: "/favicon.png" }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap" }] }), shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent });
function RootShell({ children }: { children: ReactNode }) { const themeInit = `(() => { try { var m = localStorage.getItem('jalwa_theme_mode'); if (m !== 'light' && m !== 'dark') m = 'dark'; var r = document.documentElement; r.classList.toggle('dark', m === 'dark'); r.classList.toggle('light', m === 'light'); r.style.colorScheme = m; } catch(_) {} })();`; return <html lang="en" className="dark" suppressHydrationWarning><head suppressHydrationWarning><HeadContent /><script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} /></head><body className="bg-background text-foreground" suppressHydrationWarning><div className="app-frame-outer" suppressHydrationWarning><div className="app-frame" suppressHydrationWarning>{children}</div></div><Scripts /></body></html> }
const SPLASH_GAP_MS = 60 * 60 * 1000; // Show the splash at most once per hour.
const SPLASH_TS_KEY = "jalwa_last_splash_ts";
let splashCheckedThisLoad = false;

function readLastSplash(): number {
  try {
    const v = localStorage.getItem(SPLASH_TS_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function markSplashShown() {
  try {
    localStorage.setItem(SPLASH_TS_KEY, String(Date.now()));
  } catch {}
}

function SplashGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { activeRoom } = useVoiceRoomSession();

  useEffect(() => {
    if (typeof window === "undefined" || splashCheckedThisLoad) return;
    splashCheckedThisLoad = true;

    // Never interrupt public pages or an already-open splash/room.
    if (pathname === "/privacy" || pathname === "/terms" || pathname === "/splash" || pathname.startsWith("/room/")) {
      return;
    }

    // Play the configured splash on first app launch, then only once again
    // after one hour has elapsed since the last splash was shown.
    const lastSplash = readLastSplash();
    if (!lastSplash || Date.now() - lastSplash >= SPLASH_GAP_MS) {
      markSplashShown();
      navigate({ to: "/splash", replace: true });
      return;
    }
  }, [pathname, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/privacy" || pathname === "/terms") return;
    if (activeRoom?.roomRoute && !activeRoom.isMinimized && !pathname.startsWith("/room/") && pathname !== "/splash") {
      navigate({ to: activeRoom.roomRoute as any, replace: true });
    }
  }, [pathname, navigate, activeRoom?.roomRoute, activeRoom?.isMinimized]);

  return null;
}

function GlobalRealtimeBridge() { useGlobalRealtime(); return <NotificationPopup /> }
function GlobalTokenBridge() { useEffect(() => { loadPublishedGlobalTokens().then(tokens => applyGlobalTokens(tokens)).catch(() => undefined); }, []); return null }
function PublishedStudioBridge() { const pathname = useRouterState({ select: (s) => s.location.pathname }); useEffect(() => { let cancelled = false; let cleanup: (() => void) | undefined; const run = async () => { try { const dispose = await applyCurrentPublishedConfig(pathname); if (cancelled) { dispose(); return; } cleanup = dispose; } catch {} }; void run(); return () => { cancelled = true; cleanup?.(); }; }, [pathname]); return null }
function RootComponent() { const { queryClient } = Route.useRouteContext(); useWakeLock(); const [toastTheme, setToastTheme] = useState<"light" | "dark">(() => { if (typeof document === "undefined") return "dark"; return document.documentElement.classList.contains("light") ? "light" : "dark"; }); useEffect(() => { void import("../lib/native").then((m) => m.initNativeShell()); }, []); useEffect(() => { const onChange = (e: Event) => { const d = (e as CustomEvent<"light" | "dark">).detail; if (d === "light" || d === "dark") setToastTheme(d); }; window.addEventListener("jalwa:theme-mode", onChange); return () => window.removeEventListener("jalwa:theme-mode", onChange); }, []); return <QueryClientProvider client={queryClient}><AuthProvider><VoiceRoomSessionProvider><GlobalTokenBridge /><PublishedStudioBridge /><ThemeChrome /><SplashGate /><GlobalRealtimeBridge /><InstallPermissionGate /><LaunchRouteGate /><div className="relative z-10" suppressHydrationWarning><StudioLayer /><Outlet /></div><GlobalMinimizedVoiceRoom /><Toaster position="top-center" theme={toastTheme} richColors /></VoiceRoomSessionProvider></AuthProvider></QueryClientProvider> }
