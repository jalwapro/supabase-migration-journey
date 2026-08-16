import { useMemo, useState } from "react";
import { MoreHorizontal, Paperclip, Phone, Search, Send, Smile, X } from "lucide-react";

type ChatMessage = { id: string; text: string; time: string; mine?: boolean; read?: boolean };
type ChatUser = { id: string; name: string; preview: string; time: string; unread?: number; online?: boolean; messages: ChatMessage[] };

const INITIAL_USERS: ChatUser[] = [
  { id: "ali", name: "Ali King", preview: "Hey! How are you?", time: "10:30 PM", unread: 2, online: true, messages: [
    { id: "a1", text: "Hey! How are you?", time: "10:30 PM" },
    { id: "a2", text: "I'm good, thanks! 😊", time: "10:31 PM", mine: true, read: true },
    { id: "a3", text: "Great! You did amazing in the room 🔥", time: "10:31 PM" },
    { id: "a4", text: "Thanks a lot! Appreciate it ❤️", time: "10:32 PM", mine: true, read: true },
  ] },
  { id: "sana", name: "Sana", preview: "Thanks 😊", time: "09:45 PM", unread: 1, online: true, messages: [{ id: "s1", text: "Thanks 😊", time: "09:45 PM" }] },
  { id: "zoya", name: "Zoya", preview: "Voice room was great!", time: "Yesterday", messages: [{ id: "z1", text: "Voice room was great!", time: "Yesterday" }] },
  { id: "hamza", name: "Hamza", preview: "Sent you a gift 🎁", time: "Yesterday", messages: [{ id: "h1", text: "Sent you a gift 🎁", time: "Yesterday" }] },
  { id: "ahsan", name: "Ahsan", preview: "👍", time: "2 days ago", messages: [{ id: "ah1", text: "👍", time: "2 days ago" }] },
];

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/20 bg-white text-[12px] font-black text-black">
    {name.slice(0, 1).toUpperCase()}
    {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-black" />}
  </div>;
}

export function JalwaPrivateChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [selectedId, setSelectedId] = useState("ali");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const selected = users.find((u) => u.id === selectedId) ?? users[0];
  const filtered = useMemo(() => users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase())), [users, search]);

  if (!open) return null;

  const sendMessage = () => {
    const value = draft.trim();
    if (!value) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setUsers((current) => current.map((u) => u.id === selected.id
      ? { ...u, preview: value, time, messages: [...u.messages, { id: `${Date.now()}`, text: value, time, mine: true, read: true }] }
      : u));
    setDraft("");
  };

  return <div className="fixed inset-0 z-[2147482500] bg-black/45 p-3 sm:p-5" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Private Chat" className="mx-auto flex h-[min(82vh,720px)] w-full max-w-[920px] overflow-hidden rounded-[24px] border border-black/20 bg-white text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <aside className="flex w-[38%] min-w-[128px] flex-col border-r border-black/15 bg-white">
        <div className="flex h-[58px] items-center justify-between border-b border-black/15 px-3 sm:px-4">
          <div className="text-[15px] font-black sm:text-[18px]">Private Chat</div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-black/10 p-2 sm:p-3"><div className="flex items-center gap-2 rounded-full border border-black/20 px-3 py-2">
          <Search className="h-4 w-4 shrink-0" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-black/45 sm:text-[12px]" />
        </div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((u) => <button key={u.id} onClick={() => setSelectedId(u.id)} className={`flex w-full items-center gap-2 border-b border-black/10 px-2 py-3 text-left sm:gap-3 sm:px-3 ${selected.id === u.id ? "bg-black/[0.045]" : "hover:bg-black/[0.025]"}`}>
            <Avatar name={u.name} online={u.online} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-black sm:text-[13px]">{u.name}</span><span className="shrink-0 text-[8px] text-black/55 sm:text-[10px]">{u.time}</span></div><div className="mt-0.5 flex items-center justify-between gap-1"><span className="truncate text-[9px] text-black/60 sm:text-[11px]">{u.preview}</span>{u.unread ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[8px] font-black text-white">{u.unread}</span> : null}</div></div>
          </button>)}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-[58px] items-center gap-2 border-b border-black/15 px-3 sm:gap-3 sm:px-5"><Avatar name={selected.name} online={selected.online}/><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-black sm:text-[15px]">{selected.name}</div><div className="text-[9px] text-black/55 sm:text-[11px]">{selected.online ? "Online" : "Offline"}</div></div><button aria-label="Call" className="rounded-full p-2 hover:bg-black/5"><Phone className="h-5 w-5"/></button><button aria-label="More" className="rounded-full p-2 hover:bg-black/5"><MoreHorizontal className="h-5 w-5"/></button></header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:space-y-4 sm:px-5 sm:py-5">{selected.messages.map((m) => <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl border border-black/20 px-3 py-2 text-[11px] leading-relaxed sm:text-[13px] ${m.mine ? "rounded-br-sm bg-black text-white" : "rounded-bl-sm bg-white text-black"}`}><div>{m.text}</div><div className={`mt-1 text-right text-[8px] ${m.mine ? "text-white/60" : "text-black/45"}`}>{m.time}{m.mine && m.read ? "  ✓✓" : ""}</div></div></div>)}</div>
        <div className="border-t border-black/15 p-2 sm:p-3"><div className="flex items-center gap-2"><button aria-label="Attachment" className="rounded-full p-2 hover:bg-black/5"><Paperclip className="h-5 w-5"/></button><div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-black/25 px-3 py-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder="Type a message..." className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-black/45 sm:text-[12px]"/><button aria-label="Emoji" className="rounded-full p-1 hover:bg-black/5"><Smile className="h-5 w-5"/></button></div><button onClick={sendMessage} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black bg-black text-white active:scale-95"><Send className="h-4 w-4"/></button></div></div>
      </main>
    </section>
  </div>;
}
