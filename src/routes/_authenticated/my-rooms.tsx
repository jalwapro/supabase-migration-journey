import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/my-rooms")({ component: Page });

function Page() {
  const { user } = useAuth();
  const { data: rooms } = useQuery({
    queryKey: ["my-rooms", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("id, title, cover_url, status, viewer_count, created_at, ended_at")
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <>
      <AppShell title="My Rooms">
        <div className="space-y-2 px-4 pt-4">
          {(rooms ?? []).map((r) => {
            const active = r.status === "live";
            const mins = r.ended_at
              ? Math.round((new Date(r.ended_at).getTime() - new Date(r.created_at).getTime()) / 60000)
              : Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
            return (
              <Link
                key={r.id}
                to="/room/$roomId"
                params={{ roomId: r.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)]">
                  {r.cover_url && <img src={r.cover_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    👥 {r.viewer_count} · ⏱ {mins}m · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                    active ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {active ? "Live" : "Ended"}
                </span>
              </Link>
            );
          })}
          {(rooms ?? []).length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">You haven't hosted any rooms yet</p>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
