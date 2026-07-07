import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({ component: Page });

type Tab = "following" | "followers";

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("following");

  const { data: list } = useQuery({
    queryKey: ["friends", tab, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const col = tab === "following" ? "following_id" : "follower_id";
      const otherCol = tab === "following" ? "follower_id" : "following_id";
      const { data: rows } = await supabase
        .from("follows")
        .select(`${col}, created_at`)
        .eq(otherCol, user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r: any) => r[col]);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar, level, is_vip")
        .in("id", ids);
      return profs ?? [];
    },
  });

  async function unfollow(id: string) {
    if (!user) return;
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    toast.success("Unfollowed");
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["me-counts"] });
  }

  async function followBack(id: string) {
    if (!user) return;
    const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: id });
    if (error) return toast.error(error.message);
    toast.success("Following");
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["me-counts"] });
  }

  return (
    <>
      <AppShell title="Friends">
        <div className="px-4 pt-4">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-card/60 p-1">
            {(["following", "followers"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl py-2 text-xs font-bold capitalize ${
                  tab === t ? "bg-[color:var(--primary)] text-white" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {(list ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-sm font-black">
                  {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">@{p.username}</p>
                  <p className="text-[11px] text-muted-foreground">Lv.{p.level}{p.is_vip ? " · 👑 VIP" : ""}</p>
                </div>
                {tab === "following" ? (
                  <button
                    onClick={() => unfollow(p.id)}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-bold"
                  >
                    Unfollow
                  </button>
                ) : (
                  <button
                    onClick={() => followBack(p.id)}
                    className="rounded-full bg-[color:var(--primary)] px-3 py-1 text-[11px] font-bold text-white"
                  >
                    Follow
                  </button>
                )}
              </div>
            ))}
            {(list ?? []).length === 0 && (
              <p className="py-10 text-center text-xs text-muted-foreground">Nothing here yet</p>
            )}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
