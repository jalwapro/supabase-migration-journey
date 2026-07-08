import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession() — reads from localStorage instantly and lets the SDK
    // handle silent token refresh. getUser() makes a network call on every
    // navigation; on flaky mobile networks it returns null and boots the
    // user back to /auth even though the session is perfectly valid.
    const { data } = await supabase.auth.getSession();
    let session = data.session;

    // If nothing in memory yet (cold nav before hydration finishes), give
    // the SDK a brief window to read localStorage before deciding.
    if (!session) {
      await new Promise((r) => setTimeout(r, 300));
      const retry = await supabase.auth.getSession();
      session = retry.data.session;
    }

    if (!session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
