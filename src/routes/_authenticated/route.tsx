import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CpGlobalMarquee } from "@/components/CP/CpGlobalMarquee";

function AuthedShell() {
  return <><CpGlobalMarquee /><Outlet /></>;
}

async function waitForStoredSession() {
  // Supabase persists the session locally. A single getSession() is enough for
  // route protection; the auth listener in AuthProvider handles later refreshes.
  // Retrying here added up to ~2.4s to every authenticated cold navigation.
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
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
