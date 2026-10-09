import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AdminNotification = {
  id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string | null;
  target_path: string | null;
  read_at: string | null;
  created_at: string;
};

export function AdminNotificationsBell() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const unread = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    if (!user || !isAdmin) return;
    let alive = true;
    setLoading(true);
    void supabase.from("admin_notifications")
      .select("id,recipient_id,kind,title,body,target_path,read_at,created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error("[AdminNotifications] load failed", error.message);
        else setItems((data ?? []) as AdminNotification[]);
        setLoading(false);
      });

    const channel = supabase.channel("admin-notifications-" + user.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "admin_notifications",
        filter: "recipient_id=eq." + user.id,
      }, (payload) => {
        const item = payload.new as AdminNotification;
        if (!alive) return;
        setItems((current) => [item, ...current.filter((x) => x.id !== item.id)].slice(0, 30));
        toast(item.title, { description: item.body ?? "New admin activity", duration: 7000 });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "admin_notifications",
        filter: "recipient_id=eq." + user.id,
      }, (payload) => {
        const item = payload.new as AdminNotification;
        if (alive) setItems((current) => current.map((x) => x.id === item.id ? item : x));
      })
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  const markRead = async (item: AdminNotification) => {
    if (item.read_at || !user) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((x) => x.id === item.id ? { ...x, read_at: readAt } : x));
    const { error } = await supabase.from("admin_notifications")
      .update({ read_at: readAt }).eq("id", item.id).eq("recipient_id", user.id);
    if (error) {
      setItems((current) => current.map((x) => x.id === item.id ? { ...x, read_at: null } : x));
      toast.error("Notification could not be marked read");
    }
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((item) => !item.read_at).map((item) => item.id);
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    const { error } = await supabase.from("admin_notifications")
      .update({ read_at: readAt }).eq("recipient_id", user.id).is("read_at", null);
    if (error) {
      toast.error("Could not mark all notifications read");
      void supabase.from("admin_notifications")
        .select("id,recipient_id,kind,title,body,target_path,read_at,created_at")
        .eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(30)
        .then(({ data }) => { if (data) setItems(data as AdminNotification[]); });
    }
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="fixed right-3 top-3 z-40 md:right-6 md:top-5">
      <button type="button" aria-label={unread ? `Admin notifications, ${unread} unread` : "Admin notifications"}
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-11 w-11 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-lg backdrop-blur hover:bg-accent">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <div className="absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div><p className="text-sm font-bold">Admin notifications</p><p className="text-[11px] text-muted-foreground">{unread} unread · delivered to each admin account</p></div>
          <button type="button" disabled={unread === 0} onClick={() => void markAllRead()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" /> Read all</button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {loading && items.length === 0 ? <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
            : items.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No admin notifications yet.</div>
            : items.map((item) => <div key={item.id} className={`border-b border-border/70 p-3 ${item.read_at ? "opacity-70" : "bg-primary/5"}`}>
              <button type="button" onClick={() => void markRead(item)} className="block w-full text-left">
                <div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-muted" : "bg-primary"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p>{item.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{item.body}</p>}<p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div></div>
              </button>
              {item.target_path && <Link to={item.target_path as any} onClick={() => { void markRead(item); setOpen(false); }} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open details <ExternalLink className="h-3 w-3" /></Link>}
            </div>)}
        </div>
      </div>}
    </div>
  );
}
