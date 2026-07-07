import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, ScrollText } from "lucide-react";

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

function LogsAdmin() {
  const list = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Log[];
    },
  });

  return (
    <>
      <AdminPageHeader title="Admin Logs" subtitle="Audit trail of admin actions" />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1.5">
          {list.data?.map((l) => (
            <div key={l.id} className="glass flex items-start gap-3 rounded-xl p-2.5 text-xs">
              <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate"><b>{l.action}</b> {l.target && <span className="text-muted-foreground">→ {l.target}</span>}</p>
                <p className="text-[10px] text-muted-foreground">
                  {l.admin_id?.slice(0, 8) ?? "system"} · {new Date(l.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No logs yet</p>}
        </div>
      )}
    </>
  );
}
