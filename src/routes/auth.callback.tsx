import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("Google sign-in completed, but no session was created.");
        if (!cancelled) navigate({ to: "/" });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Authentication callback failed.");
      }
    };

    if (Capacitor.isNativePlatform() || window.location.search.includes("code=")) {
      void finish();
    } else {
      void finish();
    }

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <p className="text-lg font-semibold">Signing you in…</p>
        {error && <p className="mt-3 max-w-md text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
