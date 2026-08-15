import { useState } from "react";
import { Smile, Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  if (msg.kind === "system") {
    return <div className="mx-auto rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-white/50">{msg.body}</div>;
  }
  if (msg.kind === "announcement") {
    return (
      <div className="mx-auto rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
        {msg.body}
      </div>
    );
  }
  if (msg.kind === "gift") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] px-2.5 py-1.5 text-xs animate-[fadeSlideIn_300ms_ease-out]">
        <span className="font-semibold text-fuchsia-300">{msg.userName}</span>
        <span className="text-white/60">{msg.body}</span>
        <span className="text-base">{msg.giftIcon}</span>
        <span className="font-medium text-white/80">{msg.giftName}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5 text-xs animate-[fadeSlideIn_300ms_ease-out] leading-relaxed">
      <span className={cn("shrink-0 font-semibold", msg.userColor ?? "text-violet-300")}>{msg.userName}:</span>
      <span className="text-white/80">{msg.body}</span>
    </div>
  );
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [tab, setTab] = useState<"all" | "chat">("all");
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-2 flex items-center gap-4 border-b border-white/10 pb-2">
        {(["all", "chat"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "text-xs font-semibold capitalize transition-colors",
              tab === t ? "text-white" : "text-white/40 hover:text-white/60",
            )}
          >
            {t}
            {tab === t && <span className="mt-1 block h-0.5 rounded-full bg-fuchsia-400" />}
          </button>
        ))}
      </div>

      <div className="flex min-h-[140px] flex-1 flex-col justify-end gap-1.5 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-white/35">
            <MessageCircle className="h-8 w-8" />
            <p className="text-xs font-medium">No messages yet</p>
            <p className="text-[11px]">Start the conversation</p>
          </div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} msg={m} />)
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Say something..."
          className="flex-1 bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
        />
        <button className="text-white/50 transition-colors hover:text-white" aria-label="Emoji">
          <Smile className="h-4 w-4" />
        </button>
        <button
          onClick={handleSend}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white transition-transform active:scale-90"
          aria-label="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
