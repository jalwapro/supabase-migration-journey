import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blocked")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: list } = useQuery({
    queryKey: ["blocked", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("blocked_users")
        .select("blocked_id, created_at")
        .eq("blocker_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.blocked_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar, level")
        .in("id", ids);
      return profs ?? [];
    },
  });

  async function unblock(id: string) {
    if (!user) return;
    await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    toast.success("Unblocked");
    qc.invalidateQueries({ queryKey: ["blocked"] });
  }

  return (
    <>
      <AppShell title="Blocked Users">
        <div className="space-y-2 px-4 pt-4">
          {(list ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-muted text-sm font-black">
                {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.username}</p>
                <p className="text-[11px] text-muted-foreground">Lv.{p.level}</p>
              </div>
              <button
                onClick={() => unblock(p.id)}
                className="rounded-full border border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 px-3 py-1 text-[11px] font-bold text-[color:var(--destructive)]"
              >
                Unblock
              </button>
            </div>
          ))}
          {(list ?? []).length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">No blocked users</p>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
