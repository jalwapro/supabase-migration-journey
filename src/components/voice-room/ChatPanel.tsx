import { useState, useRef, useEffect } from "react";
import { Smile, Send, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  if (msg.kind === "system") {
    return (
      <div className="mx-auto my-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-white/60 text-center">
        {msg.body}
      </div>
    );
  }
  if (msg.kind === "announcement") {
    return (
      <div className="mx-auto my-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 text-center shadow-md">
        📢 {msg.body}
      </div>
    );
  }
  if (msg.kind === "gift") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-950/60 to-purple-950/60 px-3 py-2 text-xs shadow-lg animate-fade-in">
        <span className="font-bold text-fuchsia-300">{msg.userName}</span>
        <span className="text-white/70">{msg.body}</span>
        <span className="text-lg">{msg.giftIcon}</span>
        <span className="font-black text-amber-300">{msg.giftName}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed py-1 px-2 rounded-xl bg-white/5 border border-white/5 animate-fade-in">
      <span className={cn("shrink-0 font-bold", msg.userColor ?? "text-purple-300")}>{msg.userName}:</span>
      <span className="text-white/90 break-words flex-1">{msg.body}</span>
    </div>
  );
}

export function ChatPanel({ open, onClose, messages, onSend }: ChatPanelProps) {
  const [tab, setTab] = useState<"all" | "chat">("all");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div 
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0" 
      onClick={onClose}
    >
      <div
        className="w-full max-w-[485px] h-[52svh] rounded-t-[32px] border-t border-white/20 bg-[#0d0714]/95 p-4 text-white shadow-[0_-10px_35px_rgba(139,92,246,0.25)] backdrop-blur-2xl flex flex-col justify-between animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header & Tabs */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-6">
            {(["all", "chat"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-all relative pb-1",
                  tab === t ? "text-amber-300" : "text-white/40 hover:text-white/70",
                )}
              >
                {t === "all" ? "All Messages" : "Chat Only"}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />}
              </button>
            ))}
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/80 hover:text-white active:scale-95 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages List Area */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1.5 pr-1 no-scrollbar scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/40">
              <MessageCircle className="h-10 w-10 text-purple-400/50" />
              <p className="text-xs font-bold text-white/70">No messages yet</p>
              <p className="text-[10px]">Start the conversation in room!</p>
            </div>
          ) : (
            messages.map((m) => <MessageRow key={m.id} msg={m} />)
          )}
        </div>

        {/* Input Bar */}
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shrink-0 shadow-inner">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Say something nice..."
            className="flex-1 bg-transparent text-xs font-medium text-white placeholder:text-white/40 focus:outline-none"
          />
          <button type="button" className="text-amber-300 transition-colors hover:text-amber-200 p-1" aria-label="Emoji">
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-purple-600 text-black font-bold shadow-md transition-transform active:scale-90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
