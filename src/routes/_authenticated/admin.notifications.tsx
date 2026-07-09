import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/notifications")({ component: Page });

function Page() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "vip" | "hosts">("all");

  const send = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      const { data, error } = await supabase.rpc("send_broadcast", {
        _title: title.trim(),
        _body: body.trim() || null,
        _target: target,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`Broadcast sent to ${n} users`);
      setTitle(""); setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Notifications" subtitle="Send broadcasts to all users, VIPs, or hosts" />
      <div className="glass max-w-xl rounded-2xl p-5">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</label>
        <div className="mb-4 flex gap-2">
          {(["all", "vip", "hosts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${target === t ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground border border-border"}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. New season starts today!"
          className="mb-3 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Body (optional)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Details users will see under the title"
          className="mb-4 w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <button
          onClick={() => send.mutate()}
          disabled={send.isPending || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send broadcast
        </button>
      </div>
    </>
  );
}
