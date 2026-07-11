import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationRow } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Loader2, Send, MessageCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

const EVT = "jalwa:open-notification";

export function openNotification(n: NotificationRow) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: n }));
}

export function NotificationPopup() {
  const [notif, setNotif] = useState<NotificationRow | null>(null);
  const [reply, setReply] = useState("");
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<NotificationRow>).detail;
      if (!detail) return;
      setReply("");
      setNotif(detail);
      // mark read
      if (!detail.read_at) {
        void supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", detail.id)
          .then(() => {
            qc.invalidateQueries({ queryKey: ["notif-unread", detail.user_id] });
            qc.invalidateQueries({ queryKey: ["notif-feed", detail.user_id] });
          });
      }
    };
    window.addEventListener(EVT, onOpen);
    return () => window.removeEventListener(EVT, onOpen);
  }, [qc]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !notif) throw new Error("no session");
      const senderId = (notif.data?.sender_id as string) ?? notif.actor_id;
      if (!senderId) throw new Error("Missing recipient");
      const text = reply.trim();
      if (!text) throw new Error("Type a reply");
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: senderId,
        message: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reply sent");
      setReply("");
      qc.invalidateQueries({ queryKey: ["dm_index", user?.id] });
      setNotif(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => setNotif(null);
  const goto = (path: string, params?: Record<string, string>) => {
    close();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: path as any, params: params as any });
  };

  const isDM = notif?.kind === "dm_new";
  const peerId = (notif?.data?.sender_id as string | undefined) ?? notif?.actor_id ?? null;

  function actionButton() {
    if (!notif) return null;
    if (isDM && peerId) {
      return (
        <Button variant="outline" onClick={() => goto("/messages/$peerId", { peerId })}>
          <MessageCircle className="mr-1 h-4 w-4" /> Open chat
        </Button>
      );
    }
    if (notif.entity_type === "room" && notif.entity_id) {
      return (
        <Button variant="outline" onClick={() => goto("/room/$roomId", { roomId: notif.entity_id! })}>
          <ExternalLink className="mr-1 h-4 w-4" /> Open room
        </Button>
      );
    }
    if (notif.entity_type === "recharge" || notif.kind.startsWith("recharge")) {
      return <Button variant="outline" onClick={() => goto("/wallet")}><ExternalLink className="mr-1 h-4 w-4" /> Open wallet</Button>;
    }
    if (notif.entity_type === "withdrawal" || notif.kind.startsWith("withdrawal")) {
      return <Button variant="outline" onClick={() => goto("/withdraw")}><ExternalLink className="mr-1 h-4 w-4" /> Open withdrawals</Button>;
    }
    if (notif.entity_type === "friendship" || notif.kind.startsWith("friend")) {
      return <Button variant="outline" onClick={() => goto("/friends")}><ExternalLink className="mr-1 h-4 w-4" /> Open friends</Button>;
    }
    if (notif.kind === "gift_received") {
      return <Button variant="outline" onClick={() => goto("/wallet")}><ExternalLink className="mr-1 h-4 w-4" /> Open wallet</Button>;
    }
    return null;
  }

  return (
    <DialogPrimitive.Root open={!!notif} onOpenChange={(o) => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[55%] z-50 grid w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-background/95 p-5 shadow-2xl outline-none backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        {notif && (
          <>
            <div className="flex flex-col space-y-1.5 pr-7 text-left">
              <DialogPrimitive.Title className="text-base font-semibold leading-snug">{notif.title}</DialogPrimitive.Title>
              {notif.body && (
                <DialogPrimitive.Description className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {notif.body}
                </DialogPrimitive.Description>
              )}
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {new Date(notif.created_at).toLocaleString()}
              </p>
            </div>

            {isDM && peerId && (
              <div className="mt-2 space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick reply
                </label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Type a reply…"
                  className="w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      send.mutate();
                    }
                  }}
                />
                <Button
                  onClick={() => send.mutate()}
                  disabled={send.isPending || !reply.trim()}
                  className="w-full"
                >
                  {send.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                  Send reply
                </Button>
              </div>
            )}

            <div className="mt-2 flex flex-row justify-between gap-2">
              {actionButton() ?? <span />}
              <Button variant="ghost" onClick={close}>Close</Button>
            </div>
          </>
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
