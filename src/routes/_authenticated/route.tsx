import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalRealtime } from "@/hooks/useGlobalRealtime";
import { useNotificationRealtime } from "@/hooks/useNotifications";

function AuthedShell() {
  useGlobalRealtime();
  useNotificationRealtime();
  return <Outlet />;
}

async function waitForStoredSession() {
  for (const delay of [0, 150, 350, 700, 1200]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session;
  }
  return null;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession() — reads from localStorage instantly and lets the SDK
    // handle silent token refresh. getUser() makes a network call on every
    // navigation; on flaky mobile networks it returns null and boots the
    // user back to /auth even though the session is perfectly valid.
    const session = await waitForStoredSession();

    if (!session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
