import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";

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
import { useEffect, type ReactNode } from "react";

import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeBackground } from "../components/ThemeBackground";
import { useWakeLock } from "../hooks/useWakeLock";
import { InstallPermissionGate } from "../components/InstallPermissionGate";
import { useNotificationRealtime } from "../hooks/useNotifications";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="glow-4d inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try refreshing, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="glow-4d inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a0d2e" },
      { title: "Jalwa — Live Voice & Video Party" },
      {
        name: "description",
        content:
          "Jalwa — CREATE · SHARE · SHINE. Live voice & video rooms, gifting, games and rewards.",
      },
      { property: "og:title", content: "Jalwa — Live Voice & Video Party" },
      {
        property: "og:description",
        content: "Live voice & video rooms, gifting, games and rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body className="bg-background" suppressHydrationWarning>
        <div className="app-frame-outer" suppressHydrationWarning>
          <div className="app-frame" suppressHydrationWarning>{children}</div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

// Splash plays only when the app has been closed/backgrounded for 5+ minutes.
// A regular refresh, seat change, or brief tab switch will NOT replay it.
const SPLASH_GAP_MS = 5 * 60 * 1000;
const SPLASH_TS_KEY = "jalwa_last_active_ts";
let splashShownThisLoad = false;

function readLastActive(): number {
  try {
    const v = localStorage.getItem(SPLASH_TS_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch { return 0; }
}
function touchActive() {
  try { localStorage.setItem(SPLASH_TS_KEY, String(Date.now())); } catch { /* no-op */ }
}

function SplashGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Keep a "last active" heartbeat so we can detect long absences.
  useEffect(() => {
    if (typeof window === "undefined") return;
    touchActive();
    const interval = window.setInterval(touchActive, 30_000);
    const onHide = () => touchActive();
    const onVisibility = () => {
      if (document.visibilityState === "visible") touchActive();
      else touchActive();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/splash") { splashShownThisLoad = true; return; }
    if (splashShownThisLoad) return;
    splashShownThisLoad = true;
    const last = readLastActive();
    const gap = Date.now() - last;
    if (last === 0 || gap > SPLASH_GAP_MS) {
      navigate({ to: "/splash", replace: true });
    }
    touchActive();
  }, [pathname, navigate]);
  return null;
}

function NotificationSubscriber() {
  useNotificationRealtime();
  return null;
}




function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useWakeLock();
  useEffect(() => {
    void import("../lib/native").then((m) => m.initNativeShell());
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeBackground />
        <SplashGate />
        <InstallPermissionGate />
        <NotificationSubscriber />
        <div className="relative z-10" suppressHydrationWarning>

          <Outlet />
        </div>
        <Toaster position="top-center" theme="dark" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}


