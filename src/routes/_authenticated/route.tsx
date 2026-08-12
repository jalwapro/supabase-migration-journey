import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PublishedAppConfig } from "@/components/PublishedAppConfig";

function AuthedShell() {
  return <><Outlet /><PublishedAppConfig /></>;
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
    const session = await waitForStoredSession();
    if (!session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: AuthedShell,
});
