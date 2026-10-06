import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Search, Shield, Ban, Coins as CoinsIcon, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { LevelAvatar } from "@/components/LevelAvatar";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type Row = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  frame: string | null;
  coins: number;
  diamonds: number;
  level: number;
  is_vip: boolean;
  vip_level: number;
  status: string;
  user_code: string | null;
  last_seen: string | null;
  created_at: string;
};

type FrameItem = {
  id: string;
  name: string;
  animation_url: string | null;
  preview_url: string | null;
  bg_image: string | null;
  is_active: boolean;
  theme_categories?: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
};

function frameCategory(item: FrameItem) {
  return Array.isArray(item.theme_categories) ? item.theme_categories[0] : item.theme_categories;
}

function UsersAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [vipFilter, setVipFilter] = useState<"all" | "vip" | "nonvip">("all");
  const [vipLevel, setVipLevel] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "coins_desc" | "coins_asc">("recent");

  const list = useQuery({
    queryKey: ["admin_users", q, vipFilter, vipLevel, statusFilter, dateFilter, sort],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,full_name,avatar,frame,coins,diamonds,level,is_vip,vip_level,status,user_code,last_seen,created_at")
        .order(sort === "coins_desc" || sort === "coins_asc" ? "coins" : "created_at", { ascending: sort === "coins_asc" || sort === "oldest", nullsFirst: false })
        .limit(50);
      if (vipFilter === "vip") query = query.eq("is_vip", true);
      if (vipFilter === "nonvip") query = query.eq("is_vip", false);
      if (vipLevel !== "all") query = query.eq("vip_level", Number(vipLevel));
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (dateFilter !== "all") {
        const days = Number(dateFilter.replace("d", ""));
        query = query.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
      }
      if (q.trim()) {
        const term = q.trim();
        // User IDs are UUIDs, so use an exact ID filter instead of ilike.
        // This makes the UUID copied from WhatsApp directly searchable.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);
        if (isUuid) {
          query = query.eq("id", term);
        } else {
          query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,user_code.ilike.%${term}%`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const frames = useQuery({
    queryKey: ["admin_assignable_frames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes")
        .select("id,name,animation_url,preview_url,bg_image,is_active,theme_categories:category_id(name,slug)")
        .order("sort", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as FrameItem[]).filter((item) => {
        const category = frameCategory(item);
        const slug = category?.slug?.toLowerCase() ?? "";
        const name = category?.name?.toLowerCase() ?? "";
        return slug === "frame" || slug === "frames" || name.includes("frame");
      });
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustCoins = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      // Atomic server-side delta — safe against stale-cache overwrites.
      const { error } = await supabase.rpc("adjust_coins", { _user_id: id, _delta: delta });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const assignFrame = useMutation({
    mutationFn: async ({ id, themeId }: { id: string; themeId: string }) => {
      const { error } = await supabase.rpc("admin_assign_frame", { _user_id: id, _theme_id: themeId, _equip: true, _expires_at: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frame assigned");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearFrame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_clear_frame", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frame removed");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Search, moderate and adjust balances"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username / code…" className="w-56 rounded-full border border-border bg-input py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <select value={vipFilter} onChange={(e) => setVipFilter(e.target.value as typeof vipFilter)} className="rounded-full border border-border bg-input px-3 py-2 text-xs"><option value="all">All VIP</option><option value="vip">VIP only</option><option value="nonvip">Non-VIP</option></select>\n             <select value={vipLevel} onChange={(e) => setVipLevel(e.target.value)} className="rounded-full border border-border bg-input px-3 py-2 text-xs"><option value="all">All VIP Levels</option>{Array.from({ length: 100 }, (_, i) => i + 1).map((level) => <option key={level} value={level}>VIP L{level}</option>)}</select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-full border border-border bg-input px-3 py-2 text-xs"><option value="all">All status</option><option value="active">Active</option><option value="banned">Banned</option></select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-full border border-border bg-input px-3 py-2 text-xs"><option value="all">Any registration</option><option value="7d">Registered 7d</option><option value="30d">Registered 30d</option><option value="90d">Registered 90d</option></select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-full border border-border bg-input px-3 py-2 text-xs"><option value="recent">Newest</option><option value="oldest">Oldest</option><option value="coins_desc">Coins ↓</option><option value="coins_asc">Coins ↑</option></select>
          </div>
        }
      />
      <div className="glass overflow-hidden rounded-2xl">
        {list.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2 text-right">Coins</th>
                  <th className="px-3 py-2 text-right">Diamonds</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <LevelAvatar src={u.avatar} name={u.username ?? u.full_name} level={u.level} frame={u.frame} size="sm" showBadge={false} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.username ?? u.full_name ?? "—"}</p>
                          <p className="truncate text-[10px] text-muted-foreground">Lvl {u.level} {u.is_vip && `· VIP L${u.vip_level || 0}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{u.user_code ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{u.coins.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{u.diamonds.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <a
                          href={`/admin/logs?user=${encodeURIComponent(u.username ?? u.id)}`}
                          className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-300"
                          title="View this user's activity logs"
                        >
                          Logs
                        </a>
                        <div className="relative flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2 py-1 text-fuchsia-300">
                          <Crown className="h-3.5 w-3.5" />
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) assignFrame.mutate({ id: u.id, themeId: e.target.value });
                            }}
                            disabled={frames.isLoading || assignFrame.isPending}
                            className="w-24 bg-transparent text-[10px] font-bold outline-none"
                            title="Assign DP frame"
                          >
                            <option value="">Frame</option>
                            {frames.data?.map((frame) => (
                              <option key={frame.id} value={frame.id}>
                                {frame.name}{frame.is_active ? "" : " (hidden)"}
                              </option>
                            ))}
                          </select>
                        </div>
                        {u.frame && (
                          <button
                            onClick={() => clearFrame.mutate(u.id)}
                            className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                            title="Remove frame"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const v = Number(prompt("Add coins (negative to deduct):", "100"));
                            if (Number.isFinite(v) && v !== 0) adjustCoins.mutate({ id: u.id, delta: v });
                          }}
                          className="rounded-full bg-[color:var(--gold)]/15 p-1.5 text-[color:var(--gold)]"
                          title="Adjust coins"
                        >
                          <CoinsIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatus.mutate({ id: u.id, status: u.status === "banned" ? "active" : "banned" })}
                          className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                          title={u.status === "banned" ? "Unban" : "Ban"}
                        >
                          {u.status === "banned" ? <Shield className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.data?.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
