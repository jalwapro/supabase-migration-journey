import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  user_id: string | null;
  text: string | null;
  message?: string | null;
  kind: string;
  created_at: string;
  sender_username?: string | null;
  sender_avatar?: string | null;
};

interface Props { roomId: string; }

export function ModeratorChatModeration({ roomId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("room_messages")
      .select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar")
      .eq("room_id", roomId)
      .neq("kind", "emoji")
      .order("created_at", { ascending: false })
      .limit(100);
    setMessages((data ?? []) as Message[]);
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel(`moderator-chat:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setMessages(prev => prev.filter(m => m.id !== String((payload.old as { id?: string }).id)));
        } else {
          void load();
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const removeMessage = async (messageId: string) => {
    if (busy) return;
    setBusy(messageId);
    setError(null);
    const { error } = await supabase.rpc("moderate_delete_room_message", {
      _room_id: roomId,
      _message_id: messageId,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <Trash2 className="h-4 w-4" />
        <div>
          <div className="text-xs font-bold">Chat Moderation</div>
          <div className="text-[9px] text-white/40">Remove inappropriate user messages</div>
        </div>
      </div>
      {error && <div className="rounded-xl bg-red-500/10 p-2 text-[10px] text-red-200">{error}</div>}
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-[10px] text-white/40">No room messages.</div>
        ) : messages.map(message => (
          <div key={message.id} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
            {message.sender_avatar ? <img src={message.sender_avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold">{(message.sender_username ?? "U").charAt(0).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold">{message.sender_username ?? "User"}</div>
              <div className="break-words text-[11px] text-white/80">{message.text || message.message || ""}</div>
            </div>
            <button type="button" onClick={() => void removeMessage(message.id)} disabled={busy === message.id} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-200 hover:bg-red-500/25 disabled:opacity-40" aria-label="Remove message" title="Remove message">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
