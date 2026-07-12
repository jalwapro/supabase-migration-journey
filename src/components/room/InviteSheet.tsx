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
};

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
    queryKey: ["invite-friends", user?.id],
    enabled: !!user && open,
    queryFn: async (): Promise<Friend[]> => {
      // People I follow — treat as "friends in app"
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
        .select("id, username, avatar")
        .in("id", ids);
      if (pErr) throw pErr;
      return (profs ?? []) as Friend[];
    },
  });

  const message = `${roomTitle ? `"${roomTitle}"` : "Live room"} join karo 🎤 ${roomUrl}`;

  async function sendInvite(friendId: string) {
    if (!user) return;
    setSending(friendId);
    // Try both column names to tolerate schema drift
    let error = (
      await supabase.from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: friendId,
        kind: "text",
        message,
      } as any)
    ).error;
    if (error && /recipient_id|column/i.test(error.message)) {
      error = (
        await supabase.from("direct_messages").insert({
          sender_id: user.id,
          receiver_id: friendId,
          text: message,
        } as any)
      ).error;
    }
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
    toast.success("Invite sent");
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
      className="fixed inset-0 z-[80] grid place-items-end bg-black/70"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl border-t border-border bg-background"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="text-sm font-bold">Invite Friends</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-card"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-3 py-3 text-sm font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-sm font-bold"
          >
            Copy link
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* Friends list */}
        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            App friends
          </p>
          {friends.isLoading ? (
            <div className="grid h-32 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {query
                ? "Koi match nahi mila"
                : "Abhi tak koi friend nahi. Kisi ko follow karo."}
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((f) => {
                const done = sent.has(f.id);
                const busy = sending === f.id;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5"
                  >
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-xs font-black">
                      {f.avatar ? (
                        <img
                          src={f.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (f.username ?? "?").slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">
                      {f.username ?? "user"}
                    </p>
                    <button
                      disabled={busy || done}
                      onClick={() => sendInvite(f.id)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        done
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[color:var(--primary)] text-white disabled:opacity-60"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : done ? (
                        <>
                          <Check className="h-3 w-3" /> Sent
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3" /> Invite
                        </>
                      )}
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
