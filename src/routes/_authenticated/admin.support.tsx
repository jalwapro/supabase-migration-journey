import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportAdmin,
});

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

function SupportAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [reply, setReply] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["admin_tickets", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const submit = useMutation({
    mutationFn: async ({ id, status, admin_reply }: { id: string; status?: string; admin_reply?: string }) => {
      const patch: Record<string, unknown> = {};
      if (status) patch.status = status;
      if (admin_reply !== undefined) patch.admin_reply = admin_reply;
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin_tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Support Center" subtitle="User support tickets" />
      <div className="mb-3 flex gap-2">
        {(["open", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${tab === s ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {list.data?.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">{t.subject}</p>
                <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs">{t.message}</p>
              {t.admin_reply && <p className="mt-2 rounded-lg bg-primary/10 p-2 text-xs"><b>Reply:</b> {t.admin_reply}</p>}
              {tab === "open" && (
                <div className="mt-2 flex gap-2">
                  <input
                    placeholder="Type reply…"
                    value={reply[t.id] ?? ""}
                    onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => submit.mutate({ id: t.id, admin_reply: reply[t.id] ?? "", status: "closed" })}
                    className="glow-4d inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Send className="h-3 w-3" /> Send & close
                  </button>
                </div>
              )}
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Nothing here</p>}
        </div>
      )}
    </>
  );
}
