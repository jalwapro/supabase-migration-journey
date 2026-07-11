import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationRow } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  Loader2, Send, MessageCircle, ExternalLink, X,
  Gift, Wallet, Users, Bell, Radio, HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import { playNotifySound } from "@/lib/notify-sound";

const EVT = "jalwa:open-notification";

export function openNotification(n: NotificationRow) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: n }));
}

type Theme = {
  icon: typeof Bell;
  accent: string; // gradient tailwind classes
  glow: string;   // shadow color class
  label: string;
};

function themeFor(n: NotificationRow): Theme {
  const k = n.kind;
  if (k === "dm_new") return { icon: MessageCircle, accent: "from-pink-500 to-fuchsia-500", glow: "shadow-pink-500/40", label: "Message" };
  if (k === "gift_received") return { icon: Gift, accent: "from-amber-400 to-pink-500", glow: "shadow-amber-400/40", label: "Gift" };
  if (n.entity_type === "recharge" || k.startsWith("recharge")) return { icon: Wallet, accent: "from-emerald-400 to-teal-500", glow: "shadow-emerald-400/40", label: "Wallet" };
  if (n.entity_type === "withdrawal" || k.startsWith("withdrawal")) return { icon: HandCoins, accent: "from-yellow-400 to-orange-500", glow: "shadow-yellow-400/40", label: "Withdrawal" };
  if (n.entity_type === "friendship" || k.startsWith("friend")) return { icon: Users, accent: "from-sky-400 to-indigo-500", glow: "shadow-sky-400/40", label: "Friends" };
  if (n.entity_type === "room") return { icon: Radio, accent: "from-purple-500 to-fuchsia-500", glow: "shadow-purple-500/40", label: "Room" };
  return { icon: Bell, accent: "from-violet-500 to-fuchsia-500", glow: "shadow-violet-500/40", label: "Update" };
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

export function NotificationPopup() {
  const [notif, setNotif] = useState<NotificationRow | null>(null);
  const [reply, setReply] = useState("");
  const [actorAvatar, setActorAvatar] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string | null>(null);
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<NotificationRow>).detail;
      if (!detail) return;
      setReply("");
      setActorAvatar(null);
      setActorName(null);
      setNotif(detail);
      playNotifySound();

      // Fetch actor profile for avatar/name (best effort)
      const actorId = (detail.data?.sender_id as string) ?? detail.actor_id;
      if (actorId) {
        void supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", actorId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setActorAvatar((data.avatar_url as string | null) ?? null);
              setActorName((data.username as string | null) ?? null);
            }
          });
      }

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

  const theme = useMemo(() => (notif ? themeFor(notif) : null), [notif]);
  const isDM = notif?.kind === "dm_new";
  const peerId = (notif?.data?.sender_id as string | undefined) ?? notif?.actor_id ?? null;

  function actionButton() {
    if (!notif) return null;
    if (isDM && peerId) {
      return (
        <Button size="sm" className={`bg-gradient-to-r ${theme?.accent} text-white shadow-lg ${theme?.glow} hover:opacity-95`} onClick={() => goto("/messages/$peerId", { peerId })}>
          <MessageCircle className="mr-1 h-4 w-4" /> Open chat
        </Button>
      );
    }
    if (notif.entity_type === "room" && notif.entity_id) {
      return <Button size="sm" className={`bg-gradient-to-r ${theme?.accent} text-white`} onClick={() => goto("/room/$roomId", { roomId: notif.entity_id! })}><ExternalLink className="mr-1 h-4 w-4" /> Open room</Button>;
    }
    if (notif.entity_type === "recharge" || notif.kind.startsWith("recharge") || notif.kind === "gift_received") {
      return <Button size="sm" className={`bg-gradient-to-r ${theme?.accent} text-white`} onClick={() => goto("/wallet")}><ExternalLink className="mr-1 h-4 w-4" /> Open wallet</Button>;
    }
    if (notif.entity_type === "withdrawal" || notif.kind.startsWith("withdrawal")) {
      return <Button size="sm" className={`bg-gradient-to-r ${theme?.accent} text-white`} onClick={() => goto("/withdraw")}><ExternalLink className="mr-1 h-4 w-4" /> Open withdrawals</Button>;
    }
    if (notif.entity_type === "friendship" || notif.kind.startsWith("friend")) {
      return <Button size="sm" className={`bg-gradient-to-r ${theme?.accent} text-white`} onClick={() => goto("/friends")}><ExternalLink className="mr-1 h-4 w-4" /> Open friends</Button>;
    }
    return null;
  }

  const Icon = theme?.icon ?? Bell;
  const initial = (actorName ?? notif?.title ?? "?").trim().charAt(0).toUpperCase();

  return (
    <DialogPrimitive.Root open={!!notif} onOpenChange={(o) => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-6 z-50 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-3xl p-[1.5px] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-4 data-[state=open]:slide-in-from-top-4"
          style={{
            background: theme
              ? `linear-gradient(135deg, hsl(var(--gold, 45 90% 60%) / 0.7), transparent 40%, hsl(var(--primary) / 0.5))`
              : undefined,
            boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6), 0 0 40px -8px hsl(var(--primary) / 0.35)",
          }}
        >
          {notif && theme && (
            <div className="relative overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-gradient-to-b from-[#1a0b2e]/95 via-[#2d0b4d]/95 to-[#0f0520]/95 backdrop-blur-2xl">
              {/* accent glow */}
              <div className={`pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${theme.accent} opacity-30 blur-3xl`} />
              <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-transparent blur-3xl" />

              <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-white/5 p-1.5 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>

              <div className="relative p-5">
                {/* Header row */}
                <div className="flex items-start gap-3 pr-8">
                  <div className="relative shrink-0">
                    {actorAvatar ? (
                      <img src={actorAvatar} alt="" className={`h-12 w-12 rounded-full object-cover ring-2 ring-white/20 shadow-lg ${theme.glow}`} />
                    ) : (
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${theme.accent} text-lg font-bold text-white shadow-lg ${theme.glow}`}>
                        {initial}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${theme.accent} ring-2 ring-[#1a0b2e]`}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90`}>
                        {theme.label}
                      </span>
                      <span className="text-[10px] text-white/50">{timeAgo(notif.created_at)}</span>
                    </div>
                    <DialogPrimitive.Title className="mt-1 text-base font-bold leading-tight text-white">
                      {notif.title}
                    </DialogPrimitive.Title>
                    {notif.body && (
                      <DialogPrimitive.Description className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-white/70">
                        {notif.body}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                </div>

                {/* Quick reply for DMs */}
                {isDM && peerId && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      placeholder="Type a quick reply…"
                      className="w-full resize-none rounded-xl bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          send.mutate();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between px-1 pb-0.5 pt-1">
                      <span className="text-[10px] text-white/40">⌘/Ctrl + Enter</span>
                      <button
                        onClick={() => send.mutate()}
                        disabled={send.isPending || !reply.trim()}
                        className={`inline-flex h-8 items-center gap-1 rounded-full bg-gradient-to-r ${theme.accent} px-3 text-xs font-semibold text-white shadow-lg ${theme.glow} transition hover:opacity-95 disabled:opacity-40`}
                      >
                        {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button onClick={close} className="rounded-full px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white/90">
                    Dismiss
                  </button>
                  {actionButton()}
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
