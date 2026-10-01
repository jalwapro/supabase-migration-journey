import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveMediaUrl } from "@/lib/signedMedia";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Check, X, Image as ImageIcon, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/recharge")({
  component: RechargeAdmin,
});

/** Extract "user_id/xxx.png" from a public URL like
 *  https://.../object/public/recharge-proofs/<path>, or from a bare path. */
function extractProofPath(url: string): string | null {
  const marker = "/recharge-proofs/";
  const i = url.indexOf(marker);
  if (i >= 0) return url.slice(i + marker.length).split("?")[0];
  if (url.startsWith("storage://recharge-proofs/")) return url.slice("storage://recharge-proofs/".length).split("?")[0];
  // Already a bare path.
  if (!url.startsWith("http")) return url.replace(/^\/+/, "");
  return null;
}

function ProofThumb({ url }: { url: string }) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const path = extractProofPath(url);
    if (!path) { setSigned(url); return; }
    (async () => {
      // R2-first (all media migrated), Supabase signed URL as fallback.
      const resolved = await resolveMediaUrl(`storage://recharge-proofs/${path}`);
      if (!alive) return;
      setSigned(resolved || null);
    })();
    return () => { alive = false; };
  }, [url]);

  if (!signed) {
    return (
      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-card/60">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={signed} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={signed} alt="proof" className="h-20 w-20 rounded-lg object-cover" />
    </a>
  );
}


type RechargeRow = {
  id: string;
  user_id: string;
  method: string;
  amount_pkr: number;
  coins_expected: number;
  proof_url: string | null;
  sender_name: string | null;
  sender_account: string | null;
  txn_reference: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_note: string | null;
};

type RechargeUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  user_code: string | null;
  avatar: string | null;
};

function RechargeAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [userSearch, setUserSearch] = useState("");

  const list = useQuery({
    queryKey: ["admin_recharges", tab, userSearch.trim()],
    queryFn: async () => {
      const term = userSearch.trim();
      let query = supabase
        .from("recharge_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);

      if (term) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);
        let usersQuery = supabase
          .from("profiles")
          .select("id,username,full_name,user_code,avatar")
          .limit(50);
        usersQuery = isUuid
          ? usersQuery.eq("id", term)
          : usersQuery.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,user_code.ilike.%${term}%`);
        const { data: users, error: usersError } = await usersQuery;
        if (usersError) throw usersError;
        const ids = (users ?? []).map((u) => u.id);
        if (!ids.length) return [] as RechargeRow[];
        query = query.in("user_id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RechargeRow[];
    },
  });

  const users = useQuery({
    queryKey: ["admin_recharge_users", list.data?.map((r) => r.user_id).join(",")],
    enabled: !!list.data?.length,
    queryFn: async () => {
      const ids = Array.from(new Set((list.data ?? []).map((r) => r.user_id)));
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,user_code,avatar")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as RechargeUser[];
    },
  });
  const userMap = new Map((users.data ?? []).map((u) => [u.id, u]));

  // Realtime: refresh the queue whenever anything changes so admins never
  // miss a pending request.
  useEffect(() => {
    const ch = supabase
      .channel("admin_recharges_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recharge_requests" },
        () => qc.invalidateQueries({ queryKey: ["admin_recharges"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const act = useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const fn = approve ? "approve_recharge" : "reject_recharge";
      const { error } = await supabase.rpc(fn, { _request_id: id, _admin_note: note ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved & coins credited" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin_recharges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Recharge Approvals"
        subtitle="Find the exact user, verify payment, and credit coins"
        right={
          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search username, full name, User ID or code…"
              className="w-full rounded-full border border-border bg-input py-2 pl-9 pr-9 text-sm outline-none focus:border-primary"
            />
            {userSearch && (
              <button onClick={() => setUserSearch("")} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10" aria-label="Clear user search">×</button>
            )}
          </div>
        }
      />
      <div className="mb-3 flex gap-1 rounded-full bg-card/60 p-1">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 text-xs font-bold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {list.isLoading && (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}
      {list.data?.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No {tab} recharges</p>}
      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className="glass rounded-xl p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {r.coins_expected.toLocaleString()} coins · Rs {Number(r.amount_pkr).toLocaleString()}
                </p>
                <p className="text-muted-foreground">{r.method} · {new Date(r.created_at).toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 p-2">
                  {userMap.get(r.user_id)?.avatar ? (
                    <img src={userMap.get(r.user_id)!.avatar!} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10"><UserRound className="h-4 w-4 text-primary" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{userMap.get(r.user_id)?.username ?? userMap.get(r.user_id)?.full_name ?? "Unknown user"}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {userMap.get(r.user_id)?.full_name && userMap.get(r.user_id)?.username ? userMap.get(r.user_id)?.full_name + " · " : ""}
                      Code: {userMap.get(r.user_id)?.user_code ?? "—"}
                    </p>
                    <p className="truncate font-mono text-[9px] text-muted-foreground/70">ID: {r.user_id}</p>
                  </div>
                </div>
                {r.sender_name && <p>From: {r.sender_name}</p>}
                {r.sender_account && <p>Acct: {r.sender_account}</p>}
                {r.txn_reference && <p>Ref: {r.txn_reference}</p>}
                {r.note && <p className="text-muted-foreground">Note: {r.note}</p>}
                {r.admin_note && <p className="mt-1 text-[10px] text-[color:var(--gold)]">Admin: {r.admin_note}</p>}
              </div>
              {r.proof_url ? (
                <ProofThumb url={r.proof_url} />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-card/60">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            {tab === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: r.id, approve: true })}
                  className="flex-1 rounded-full bg-emerald-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Check className="mr-1 inline h-3 w-3" /> Approve
                </button>
                <button
                  disabled={act.isPending}
                  onClick={() => {
                    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                    act.mutate({ id: r.id, approve: false, note });
                  }}
                  className="flex-1 rounded-full bg-red-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <X className="mr-1 inline h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
