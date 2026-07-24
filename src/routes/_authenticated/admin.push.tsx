import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enableFcmForUser } from "@/lib/fcm-client";
import { useAuth } from "@/hooks/useAuth";

type Health = {
  env: Record<string, boolean>;
  user_id: string;
  subscriptions: Array<{
    id: string;
    platform: string | null;
    endpoint: string | null;
    fcm_token: string | null;
    user_agent: string | null;
    last_seen: string | null;
    created_at: string;
  }>;
  counts: { total: number; web: number; fcm: number };
};

type TestResult = {
  delivered: number;
  failed: number;
  pruned: number;
  web: number;
  fcm: number;
  note?: string;
  results?: Array<{
    id: string;
    kind: "web" | "fcm";
    ok: boolean;
    status: number;
    error?: string;
  }>;
};

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const Route = createFileRoute("/_authenticated/admin/push")({
  component: AdminPushPage,
});

function AdminPushPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("Jalwa push test");
  const [body, setBody] = useState("If you can see this, notifications are live.");

  const health = useQuery<Health>({
    queryKey: ["admin", "push-health"],
    queryFn: () => authedFetch("/api/admin/push-test"),
    staleTime: 15_000,
  });

  const sendTest = useMutation({
    mutationFn: (): Promise<TestResult> =>
      authedFetch("/api/admin/push-test", {
        method: "POST",
        body: JSON.stringify({
          target_user_id: targetUserId.trim() || undefined,
          title,
          body,
        }),
      }),
    onSuccess: (res) => {
      if (res.note === "no subscriptions") {
        toast.warning("No push subscriptions for this user");
      } else {
        toast.success(`Delivered ${res.delivered}/${res.delivered + res.failed}` + (res.pruned ? ` · pruned ${res.pruned}` : ""));
      }
      qc.invalidateQueries({ queryKey: ["admin", "push-health"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const registerFcm = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const r = await enableFcmForUser(user.id);
      if (!r) throw new Error("Permission denied or unsupported");
      return r;
    },
    onSuccess: () => {
      toast.success("FCM token registered");
      qc.invalidateQueries({ queryKey: ["admin", "push-health"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const env = health.data?.env;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Push Diagnostics"
        subtitle="Verify FCM + Web Push pipeline and send test notifications."
        right={
          <Button variant="outline" size="sm" onClick={() => health.refetch()} disabled={health.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading || !env ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(env).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{k}</span>
                  {v ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> set
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" /> missing
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Your subscriptions ({health.data?.counts.total ?? 0})</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => registerFcm.mutate()} disabled={registerFcm.isPending}>
            {registerFcm.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Register this device (FCM)
          </Button>
        </CardHeader>
        <CardContent>
          {health.data?.subscriptions.length ? (
            <div className="space-y-2">
              {health.data.subscriptions.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline">{s.fcm_token ? "fcm" : "web"}</Badge>
                    <span className="text-muted-foreground">{s.platform ?? "—"}</span>
                    <span className="ml-auto text-muted-foreground">
                      last seen {s.last_seen ? new Date(s.last_seen).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {s.fcm_token ? `fcm:${s.fcm_token.slice(0, 24)}…` : s.endpoint?.slice(0, 90) + "…"}
                  </div>
                  {s.user_agent && <div className="mt-1 truncate text-[11px] text-muted-foreground">{s.user_agent}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No push subscriptions on this account. Register this device to test.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send test push</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="target">Target user ID (leave blank = self)</Label>
            <Input
              id="target"
              placeholder={user?.id ?? "user uuid"}
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Body</Label>
              <Input id="body" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => sendTest.mutate()} disabled={sendTest.isPending} className="gap-1.5">
            {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test push
          </Button>

          {sendTest.data && (
            <div className="mt-3 space-y-2 rounded-lg border border-border p-3 text-xs">
              <div className="flex flex-wrap gap-3">
                <span>delivered: <b>{sendTest.data.delivered}</b></span>
                <span>failed: <b>{sendTest.data.failed}</b></span>
                <span>pruned: <b>{sendTest.data.pruned}</b></span>
                <span>web: {sendTest.data.web}</span>
                <span>fcm: {sendTest.data.fcm}</span>
              </div>
              {sendTest.data.results?.map((r) => (
                <div key={r.id + r.kind} className="flex items-center gap-2 rounded border border-border/60 px-2 py-1">
                  {r.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                  <span className="text-muted-foreground">status {r.status}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span>
                  {r.error && <span className="ml-auto truncate text-destructive/80">{r.error.slice(0, 120)}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
