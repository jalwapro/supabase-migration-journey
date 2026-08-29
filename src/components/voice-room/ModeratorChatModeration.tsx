import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username?: string | null; avatar_url?: string | null } | null;
};

interface Props { roomId: string; moderatorId: string; }

export function ModeratorChatModeration({ roomId, moderatorId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("room_messages")
      .select("id,room_id,user_id,content,created_at,profiles(username,avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setMessages((data ?? []) as Message[]);
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel(`moderator-chat:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
        } else {
          void load();
        }
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const removeMessage = async (messageId: string) => {
    setBusy(messageId); setError(null);
    const { error } = await supabase.rpc("moderate_delete_room_message", {
      _room_id: roomId,
      _message_id: messageId,
      _moderator_id: moderatorId,
    });
    setBusy(null);
    if (error) { setError(error.message); return; }
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">💬 Chat Moderation</div>
      {error && <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
      {messages.length === 0 ? (
        <div className="rounded-xl border border-border/50 p-3 text-xs text-muted-foreground">No room messages.</div>
      ) : messages.map(message => (
        <div key={message.id} className="flex items-start gap-2 rounded-xl border border-border/50 p-3">
          <img className="h-8 w-8 rounded-full object-cover" src={message.profiles?.avatar_url || "/placeholder.svg"} alt="" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">{message.profiles?.username || "User"}</div>
            <div className="break-words text-sm">{message.content}</div>
          </div>
          <button type="button" onClick={() => void removeMessage(message.id)} disabled={busy === message.id} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label="Remove message" title="Remove message">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
