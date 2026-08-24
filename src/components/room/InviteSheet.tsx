import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Send, Check, Loader2, MessageCircle, Search, Users } from "lucide-react";
import { toast } from "sonner";

type Friend = {
  id: string;
  username: string | null;
  avatar: string | null;
  last_seen: string | null;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function InviteSheet({
  open,
  onClose,
  roomUrl,
  roomTitle,
}: {
  open: boolean;
  onClose: () => void;
  roomUrl: string;
  roomTitle: string;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const friends = useQuery({
    queryKey: ["invite-online-friends", user?.id],
    enabled: !!user && open,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Friend[]> => {
      const { data: rows, error } = await supabase
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const ids = (rows ?? []).map((r: any) => r.following_id as string);
      if (ids.length === 0) return [];

      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, avatar, last_seen")
        .in("id", ids)
        .order("last_seen", { ascending: false, nullsFirst: false });
      if (pErr) throw pErr;

      const cutoff = Date.now() - ONLINE_WINDOW_MS;
      return ((profs ?? []) as Friend[]).filter((friend) => {
        if (!friend.last_seen) return false;
        const seenAt = Date.parse(friend.last_seen);
        return Number.isFinite(seenAt) && seenAt >= cutoff;
      });
    },
  });

  const message = `${roomTitle ? `"${roomTitle}"` : "Live room"} join karo 🎤 ${roomUrl}`;

  async function sendInvite(friendId: string) {
    if (!user) return;
    setSending(friendId);

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: friendId,
      kind: "text",
      text: message,
    } as any);

    setSending(null);
    if (error) {
      if (/row-level|policy|are_friends/i.test(error.message)) {
        toast.error("Sirf friends ko in-app invite bhej sakte ho");
      } else {
        toast.error(error.message);
      }
      return;
    }

    setSent((s) => new Set(s).add(friendId));
    toast.success("Invite sent — private message aur notification bhej di gayi");
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  if (!open) return null;

  const list = (friends.data ?? []).filter((f) =>
    query.trim()
      ? (f.username ?? "").toLowerCase().includes(query.trim().toLowerCase())
      : true,
  );

  return (
    <div
      data-jalwa-overlay="true"
      className="fixed inset-0 z-[80] grid place-items-end bg-black/70"
      onClick={onClose}
    >
      <div
        data-jalwa-overlay-content="true"
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl border-t border-border bg-background"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="text-sm font-bold">Invite Online Friends</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-3 py-3 text-sm font-bold text-white">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
          <button onClick={copyLink} className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-sm font-bold">
            Copy link
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search online friends…" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Online friends</p>
          {friends.isLoading ? (
            <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {query ? "Koi online friend match nahi mila" : "Abhi koi friend online nahi hai."}
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((f) => {
                const done = sent.has(f.id);
                const busy = sending === f.id;
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5">
                    <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-xs font-black">
                      {f.avatar ? <img src={f.avatar} alt="" className="h-full w-full object-cover" /> : (f.username ?? "?").slice(0, 1).toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" aria-label="Online" />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">{f.username ?? "user"}</p>
                    <button disabled={busy || done} onClick={() => sendInvite(f.id)} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${done ? "bg-emerald-500/20 text-emerald-400" : "bg-[color:var(--primary)] text-white disabled:opacity-60"}`}>
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <><Check className="h-3 w-3" /> Sent</> : <><Send className="h-3 w-3" /> Invite</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
