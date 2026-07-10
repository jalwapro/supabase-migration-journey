import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "daily_spin_popup_dismissed_at";

export function DailySpinPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

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
    if (!user || nextAt.data === undefined) return;
    const readyAt = nextAt.data ? new Date(nextAt.data).getTime() : 0;
    const ready = readyAt <= Date.now();
    if (!ready) return;
    // Suppress re-showing within same ready-window (dismiss for 2h)
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissed < 2 * 60 * 60 * 1000) return;
    setOpen(true);
  }, [user, nextAt.data]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-xs overflow-hidden border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--gold)]/20 via-[color:var(--primary)]/15 to-background p-0">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-background/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="px-5 pb-5 pt-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--primary)] text-5xl shadow-[0_0_40px_-5px_color-mix(in_oklab,var(--gold)_60%,transparent)]">
            🎁
          </div>
          <DialogHeader className="mt-3">
            <DialogTitle className="text-center text-lg font-black text-gradient">
              Your Daily Spin is Ready!
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Spin the wheel and win coins, diamonds, frames or themes — free every 24 hours.
          </p>
          <Link
            to="/games/daily-spin"
            onClick={() => setOpen(false)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" /> Spin Now
          </Link>
          <button
            onClick={dismiss}
            className="mt-2 w-full py-2 text-[11px] text-muted-foreground"
          >
            Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
