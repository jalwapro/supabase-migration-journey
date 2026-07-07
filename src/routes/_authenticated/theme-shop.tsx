import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/theme-shop")({ component: Page });

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["theme-shop", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [themes, owned] = await Promise.all([
        supabase.from("themes").select("*").eq("is_active", true).order("sort"),
        supabase.from("user_themes").select("theme_id").eq("user_id", user!.id),
      ]);
      return {
        themes: themes.data ?? [],
        owned: new Set((owned.data ?? []).map((o) => o.theme_id)),
      };
    },
  });

  async function unlock(theme: any) {
    if (!user || !profile) return;
    if (!theme.is_free && profile.coins < theme.price) return toast.error("Not enough coins");
    const { error } = await supabase.from("user_themes").insert({ user_id: user.id, theme_id: theme.id });
    if (error) return toast.error(error.message);
    if (!theme.is_free) {
      await supabase.from("profiles").update({ coins: profile.coins - theme.price }).eq("id", user.id);
    }
    toast.success("Theme unlocked");
    qc.invalidateQueries({ queryKey: ["theme-shop"] });
  }

  async function apply(themeId: string) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ theme_id: themeId }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Theme applied");
  }

  return (
    <>
      <AppShell title="Theme Shop" showBack>
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {(data?.themes ?? []).map((t: any) => {
            const isOwned = data?.owned.has(t.id) ?? false;
            const isActive = profile?.theme_id === t.id;
            return (
              <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card/60">
                <div
                  className="h-24 w-full"
                  style={{
                    background: t.bg_image
                      ? `url(${t.bg_image}) center/cover`
                      : `linear-gradient(135deg, ${t.primary_color}, ${t.accent_color})`,
                  }}
                />
                <div className="space-y-2 p-2.5">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.is_free ? "Free" : `💰 ${t.price}`}
                  </p>
                  {isActive ? (
                    <div className="flex items-center justify-center gap-1 rounded-lg bg-[color:var(--gold)]/20 py-1.5 text-[11px] font-bold text-[color:var(--gold)]">
                      <Check className="h-3 w-3" /> Active
                    </div>
                  ) : isOwned ? (
                    <button
                      onClick={() => apply(t.id)}
                      className="w-full rounded-lg bg-[color:var(--primary)] py-1.5 text-[11px] font-bold text-white"
                    >
                      Apply
                    </button>
                  ) : (
                    <button
                      onClick={() => unlock(t)}
                      className="w-full rounded-lg border border-[color:var(--primary)] py-1.5 text-[11px] font-bold text-[color:var(--primary)]"
                    >
                      {t.is_free ? "Unlock" : `Buy ${t.price}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
