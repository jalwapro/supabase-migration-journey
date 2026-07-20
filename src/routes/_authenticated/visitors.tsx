import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/visitors")({ component: Page });

type Row = { viewer_id: string; viewed_at: string };
type Prof = { id: string; username: string | null; avatar: string | null; user_code: string | null; level: number | null; is_vip: boolean | null };

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

function Page() {
  const { user } = useAuth();
  useRealtimeInvalidate(`visitors-${user?.id ?? "anon"}`, [
    { table: "profile_views", invalidate: [["profile-visitors-list"]] },
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-visitors-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("profile_views")
        .select("viewer_id, viewed_at")
        .eq("owner_id", user!.id)
        .order("viewed_at", { ascending: false })
        .limit(100);
      const list = (rows ?? []) as Row[];
      if (!list.length) return [] as Array<Row & { p?: Prof }>;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar, user_code, level, is_vip")
        .in("id", list.map((r) => r.viewer_id));
      const byId = new Map<string, Prof>((profs ?? []).map((p: any) => [p.id, p]));
      return list.map((r) => ({ ...r, p: byId.get(r.viewer_id) }));
    },
  });

  return (
    <>
      <AppShell title="Profile Visitors" subtitle="People who viewed your profile">
        <div className="px-4 pt-4">
          {isLoading && <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="py-16 text-center">
              <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No visitors yet</p>
            </div>
          )}
          <div className="space-y-2">
            {(data ?? []).map((r) => (
              <Link
                key={r.viewer_id}
                to="/u/$userId"
                params={{ userId: r.viewer_id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
              >
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-sm font-black">
                  {r.p?.avatar ? <img src={r.p.avatar} className="h-full w-full object-cover" alt="" /> : (r.p?.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {r.p?.username ?? "User"}
                    {r.p?.user_code && <span className="ml-1 text-[10px] font-normal text-muted-foreground">#{r.p.user_code}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Lv.{r.p?.level ?? 0}{r.p?.is_vip ? " · 👑 VIP" : ""} · {timeAgo(r.viewed_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
