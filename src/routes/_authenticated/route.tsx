import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isStudioPreview, STUDIO_PREVIEW_USER } from "@/lib/studio-preview";

function AuthedShell() {
  return <Outlet />;
}

async function waitForStoredSession() {
  if (isStudioPreview()) return { user: STUDIO_PREVIEW_USER } as Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];
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
