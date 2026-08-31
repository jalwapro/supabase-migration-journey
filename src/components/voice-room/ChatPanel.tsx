import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, X, Megaphone, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  announcement?: string | null;
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

export function ChatPanel({ open, onClose, messages, onSend, announcement }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [showInputPopup, setShowInputPopup] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external messages with local list
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, open]);

  useEffect(() => {
    if (showInputPopup && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInputPopup]);

  if (!open) return null;

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    // Optimistic local update taake foran chat box mein message show ho jaye
    const optimisticMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      kind: "chat",
      userName: "You",
      body: text,
      userColor: "text-amber-300"
    };

    setLocalMessages(prev => [...prev, optimisticMsg]);
    onSend(text);
    
    setDraft(""); 
    setShowInputPopup(false); 
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
        {/* Top Header & Announcement Bar */}
        <div className="flex flex-col gap-2 border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">Room Chat & Notice</h3>
            <button 
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/80 hover:text-white active:scale-95 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-medium shadow-inner">
            <Megaphone className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span className="truncate flex-1">{announcement || "Welcome to the room! Follow room rules."}</span>
          </div>
        </div>

        {/* Messages List Area */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1.5 pr-1 no-scrollbar scroll-smooth">
          {localMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/40">
              <MessageCircle className="h-10 w-10 text-purple-400/50" />
              <p className="text-xs font-bold text-white/70">No messages yet</p>
              <p className="text-[10px]">Start the conversation in room!</p>
            </div>
          ) : (
            localMessages.map((m) => <MessageRow key={m.id} msg={m} />)
          )}
        </div>

        {/* Bottom Trigger Bar */}
        <div 
          onClick={() => setShowInputPopup(true)}
          className="mt-2 flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 shrink-0 shadow-inner cursor-pointer active:scale-95 transition"
        >
          <span className="text-xs font-medium text-white/40">Say something nice...</span>
          <div className="flex items-center gap-2 text-amber-300">
            <Edit3 className="h-4 w-4" />
          </div>
        </div>

      </div>

      {/* Clean Comment Input Popup */}
      {showInputPopup && (
        <div 
          className="absolute inset-0 z-[2147483500] flex items-end justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0"
          onClick={() => setShowInputPopup(false)}
        >
          <div 
            className="w-full max-w-[485px] bg-[#120a1f] border-t border-amber-500/40 p-3 rounded-t-3xl shadow-2xl flex items-center gap-2 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your comment..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              enterKeyHint="send"
              inputMode="text"
              className="flex-1 bg-black/50 border border-white/20 rounded-2xl px-4 py-3 text-xs font-medium text-white placeholder:text-white/40 outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-purple-600 text-black font-extrabold text-xs shadow-lg active:scale-95 transition disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
