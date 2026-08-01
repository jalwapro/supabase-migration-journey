import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsAdmin,
});

type Log = {
  id: string;
  admin_id: string | null;
  action: string;
  target: string | null;
  details: unknown;
  created_at: string;
};

const PAGE_SIZE = 50;

const ACTION_GROUPS: Record<string, string> = {
  all: "All actions",
  "withdrawal.": "Withdrawals",
  "recharge.": "Recharges",
  "role.": "Roles",
  "room.": "Rooms",
  "vip.": "VIP",
  "frame.": "Frames",
  "coins.": "Coins",
  "pk.": "PK",
  "report.": "Reports",
};

function LogsAdmin() {
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  // Resolve a username search term to user ids so logs can be filtered
  // by "who did it" or "who it was done to".
  const matchedUsers = useQuery({
    queryKey: ["admin_logs_user_match", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", `%${q.trim()}%`)
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => r.id as string);
    },
  });

  const list = useQuery({
    queryKey: ["admin_logs", group, q, page, matchedUsers.data?.join(",") ?? ""],
    enabled: q.trim().length < 2 || !matchedUsers.isLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("admin_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (group !== "all") {
        query = query.like("action", `${group}%`);
      }
      const term = q.trim();
      if (term) {
        const ids = matchedUsers.data ?? [];
        const clauses = [
          `action.ilike.%${term}%`,
          `target.ilike.%${term}%`,
          `admin_id::text.ilike.%${term}%`,
        ];
        if (ids.length) {
          clauses.push(`admin_id.in.(${ids.join(",")})`, `target.in.(${ids.join(",")})`);
        }
        query = query.or(clauses.join(","));
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Log[], total: count ?? 0 };
    },
  });

  // Names for the actor (admin) and the affected user shown on each row.
  const idsOnPage = useMemo(() => {
    const set = new Set<string>();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const l of list.data?.rows ?? []) {
      if (l.admin_id) set.add(l.admin_id);
      if (l.target && uuid.test(l.target)) set.add(l.target);
    }
    return [...set];
  }, [list.data?.rows]);

  const names = useQuery({
    queryKey: ["admin_logs_names", idsOnPage.join(",")],
    enabled: idsOnPage.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .in("id", idsOnPage);
      if (error) throw error;
      const map: Record<string, { username: string | null; avatar: string | null }> = {};
      for (const r of data ?? []) map[r.id as string] = { username: r.username as string | null, avatar: r.avatar as string | null };
      return map;
    },
  });

  const nameOf = (id: string | null) =>
    !id ? "system" : (names.data?.[id]?.username ?? `${id.slice(0, 8)}…`);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE)),
    [list.data?.total],
  );

  return (
    <>
      <AdminPageHeader
        title="Admin Logs"
        subtitle="Audit trail — roles, withdrawals, recharges, and admin actions"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={group}
          onValueChange={(v) => {
            setGroup(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTION_GROUPS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search by username, action, target, or user id…"
          className="h-9 flex-1 text-xs"
        />
        <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page === 0 || list.isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[70px] text-center">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page + 1 >= totalPages || list.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.data?.rows.map((l) => (
            <div
              key={l.id}
              className="glass flex items-start gap-3 rounded-xl p-2.5 text-xs"
            >
              <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <b>{l.action}</b>{" "}
                  {l.target && (
                    <span className="text-muted-foreground">→ {nameOf(l.target)}</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <button
                    type="button"
                    className="font-semibold text-[color:var(--primary)] hover:underline"
                    onClick={() => {
                      if (!l.admin_id) return;
                      setQ(names.data?.[l.admin_id]?.username ?? l.admin_id);
                      setPage(0);
                    }}
                  >
                    {nameOf(l.admin_id)}
                  </button>{" "}
                  · {new Date(l.created_at).toLocaleString()}
                </p>
                {l.details ? (
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-1.5 text-[10px] leading-tight text-muted-foreground">
                    {JSON.stringify(l.details, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ))}
          {list.data?.rows.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No logs match these filters
            </p>
          )}
        </div>
      )}
    </>
  );
}
