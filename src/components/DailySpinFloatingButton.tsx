import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "daily_spin_float_dismissed_at";

export function DailySpinFloatingButton() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const nextAt = useQuery({
    queryKey: ["next_spin_at", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("next_spin_at");
      if (error) throw error;
      return data as string | null;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissed < 2 * 60 * 60 * 1000) setHidden(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!user || hidden) return null;

  const readyAt = nextAt.data ? new Date(nextAt.data).getTime() : 0;
  const ready = readyAt <= now;
  const remaining = Math.max(0, readyAt - now);
  const hh = Math.floor(remaining / 3_600_000);
  const mm = Math.floor((remaining % 3_600_000) / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);
  const countdown = `${hh.toString().padStart(2, "0")}:${mm
    .toString()
    .padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-md justify-end px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
    >
      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute -right-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow"
        >
          <X className="h-3 w-3" />
        </button>
        <Link
          to="/games/daily-spin"
          aria-label="Daily Spin"
          className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
        >
          <span
            aria-hidden
            className={`absolute inset-0 rounded-full ${ready ? "animate-ping bg-[color:var(--gold)]/40" : ""}`}
          />
          <span className="relative flex flex-col items-center leading-none">
            <Sparkles className="h-5 w-5" />
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider">
              Spin
            </span>
          </span>
          {ready ? (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow ring-2 ring-background">
              Free
            </span>
          ) : (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[9px] font-bold tabular-nums text-white ring-1 ring-white/20">
              {countdown}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
