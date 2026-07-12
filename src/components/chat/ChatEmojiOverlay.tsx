import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Full-screen animated-emoji player. Plays incoming chat_emoji_sends
 * one-by-one for the given scope. Same visual language as GiftAnimationPlayer.
 *
 * scope:
 *   - { type: "dm",   selfId, peerId }  → renders when either user is sender/recipient
 *   - { type: "room", roomId }          → renders all room sends
 */
type Scope =
  | { type: "dm"; selfId: string; peerId: string }
  | { type: "room"; roomId: string };

type Play = {
  key: string;
  senderName: string;
  senderAvatar: string | null;
  emoji: string;
  name: string;
  clip: string;
};

const PLAY_MS = 2800;

export function ChatEmojiOverlay({ scope }: { scope: Scope }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((p: Play) => {
    if (seenRef.current.has(p.key)) return;
    seenRef.current.add(p.key);
    setQueue((q) => [...q, p]);
  }, []);

  useEffect(() => {
    const chanKey =
      scope.type === "dm"
        ? `chat-emoji-dm-${scope.selfId}-${scope.peerId}`
        : `chat-emoji-room-${scope.roomId}`;
    const filter =
      scope.type === "room" ? `room_id=eq.${scope.roomId}` : undefined;

    const ch = supabase
      .channel(chanKey)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_emoji_sends",
          ...(filter ? { filter } : {}),
        },
        async (payload) => {
          const r = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string | null;
            room_id: string | null;
            emoji_char: string;
            emoji_name: string;
            clip_path: string;
          };

          if (scope.type === "dm") {
            const pair =
              (r.sender_id === scope.selfId && r.recipient_id === scope.peerId) ||
              (r.sender_id === scope.peerId && r.recipient_id === scope.selfId);
            if (!pair) return;
          }

          const { data: prof } = await supabase
            .from("profiles")
            .select("username,avatar")
            .eq("id", r.sender_id)
            .maybeSingle();
          const p = (prof ?? {}) as { username?: string; avatar?: string | null };
          enqueue({
            key: `em-${r.id}`,
            senderName: p.username ?? "Guest",
            senderAvatar: p.avatar ?? null,
            emoji: r.emoji_char,
            name: r.emoji_name,
            clip: r.clip_path,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // scope object identity is stable per parent render — using its fields
  }, [scope, enqueue]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), PLAY_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/40" />
      <div className="absolute left-4 top-6 flex items-center gap-2 gift-anim-sender">
        {current.senderAvatar ? (
          <img
            src={current.senderAvatar}
            alt=""
            className="h-9 w-9 rounded-full border-2 border-[color:var(--gold)] object-cover shadow-lg"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-xs font-bold text-white">
            {initial}
          </div>
        )}
        <div className="rounded-full bg-black/70 px-3 py-1">
          <p className="text-[11px] font-bold leading-none text-white">{current.senderName}</p>
          <p className="text-[10px] font-bold leading-tight text-[color:var(--gold)]">
            sent {current.name}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <img
          src={current.clip}
          alt=""
          className="gift-anim-emoji h-[40vh] max-h-[380px] w-auto max-w-[80vw] object-contain drop-shadow-[0_8px_32px_rgba(255,180,60,0.5)]"
        />
      </div>
    </div>
  );
}
