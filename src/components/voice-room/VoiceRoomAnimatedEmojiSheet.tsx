import { useEffect, useMemo, useState } from "react";
import { Loader2, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChatEmoji } from "@/components/chat/ChatEmojiSheet";

type EmojiReceiver = { id: string; username: string | null; avatar: string | null; seat_index: number | null };
const TIERS: { key: "normal" | "vip"; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "vip", label: "👑 VIP" },
];
type Props = { open: boolean; onClose: () => void; onPick: (emoji: ChatEmoji, targetSeatIndex?: number | null) => void; embedded?: boolean };

type EmojiCache = { expiresAt: number; data: ChatEmoji[] };
type ReceiverCache = { expiresAt: number; data: EmojiReceiver[] };
const emojiCache = new Map<string, EmojiCache>();
const receiverCache = new Map<string, ReceiverCache>();
const EMOJI_CACHE_TTL = 5 * 60_000;
const RECEIVER_CACHE_TTL = 15_000;

export function VoiceRoomAnimatedEmojiSheet({ open, onClose, onPick, embedded = false }: Props) {
  const { isAdmin, profile } = useAuth();
  const [list, setList] = useState<ChatEmoji[]>([]);
  const [receivers, setReceivers] = useState<EmojiReceiver[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<"normal" | "vip">("normal");
  const isVip = isAdmin || (profile?.vip_level ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const roomId = typeof window !== "undefined" ? window.location.pathname.match(/^\/room\/([^/]+)/)?.[1] : null;
    const cachedEmojis = emojiCache.get("global");
    const cachedReceivers = roomId ? receiverCache.get(roomId) : null;
    if (cachedEmojis && cachedEmojis.expiresAt > Date.now()) setList(cachedEmojis.data);
    if (cachedReceivers && cachedReceivers.expiresAt > Date.now()) setReceivers(cachedReceivers.data);
    if ((cachedEmojis?.expiresAt ?? 0) > Date.now() && (cachedReceivers?.expiresAt ?? 0) > Date.now()) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const load = async () => {
      const [{ data: emojis, error: emojiError }, { data: members, error: memberError }] = await Promise.all([
        cachedEmojis && cachedEmojis.expiresAt > Date.now()
          ? Promise.resolve({ data: cachedEmojis.data, error: null })
          : supabase.from("chat_emojis").select("id,slug,emoji,name,category,clip_path,sort_order,tier,min_vip_level").eq("is_active", true).order("sort_order", { ascending: true }),
        roomId && !(cachedReceivers && cachedReceivers.expiresAt > Date.now())
          ? supabase.from("room_members").select("user_id,seat_index,profiles(id,username,avatar)").eq("room_id", roomId).not("seat_index", "is", null).order("seat_index", { ascending: true })
          : Promise.resolve({ data: cachedReceivers?.data ?? [], error: null } as any),
      ]);
      if (!active) return;
      if (emojiError) { toast.error("Emojis load nahi ho sake"); setList([]); } else {
        const seen = new Set<string>();
        const nextEmojis = (emojis ?? []).filter((row) => { const key = row.slug || row.id; if (seen.has(key)) return false; seen.add(key); return true; }).map((e) => ({ ...(e as ChatEmoji), url: e.clip_path }));
        emojiCache.set("global", { expiresAt: Date.now() + EMOJI_CACHE_TTL, data: nextEmojis });
        setList(nextEmojis);
      }
      if (memberError) { toast.error("Room users load nahi ho sake"); setReceivers([]); } else {
        const nextReceivers = (members ?? []).map((m: any) => ({ id: m.profiles?.id || m.user_id, username: m.profiles?.username || "User", avatar: m.profiles?.avatar || null, seat_index: m.seat_index })).filter((r: EmojiReceiver) => r.seat_index != null);
        if (roomId) receiverCache.set(roomId, { expiresAt: Date.now() + RECEIVER_CACHE_TTL, data: nextReceivers });
        setReceivers(nextReceivers);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) setSelectedReceiver(null);
    else if (!selectedReceiver && receivers.length) setSelectedReceiver(receivers.find((r) => r.id === profile?.id)?.id ?? receivers[0].id);
  }, [open, receivers, selectedReceiver, profile?.id]);

  const filtered = useMemo(() => list.filter((e) => tier === "normal" ? (e.tier ?? "normal") === "normal" : (e.tier ?? "normal") !== "normal"), [list, tier]);
  if (!open) return null;

  const pickEmoji = (emoji: ChatEmoji) => {
    const receiver = receivers.find((r) => r.id === selectedReceiver);
    const targetSeat = receiver?.seat_index ?? null;
    if (targetSeat == null) { toast.info("Pehle user select karein"); return; }
    // Voice-room playback is handled by ChatEmojiSheet -> realtime. Do not
    // trigger the old VoiceRoomScreen center/splash animation here.
    onPick(emoji, targetSeat);
    onClose();
  };

  const content = (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-3 py-2"><div className="flex items-center gap-1.5"><Smile className="h-4 w-4 text-amber-400" /><span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">Animated Emojis</span><div className="flex gap-1">{TIERS.map((item) => <button key={item.key} type="button" onClick={() => { if (item.key === "vip" && !isVip) { toast.info("👑 VIP emojis VIP members ke liye hain"); return; } setTier(item.key); }} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tier === item.key ? "bg-gradient-to-r from-pink-500 to-violet-600 text-white" : "bg-white/10 text-white/70"}`}>{item.label}</button>)}</div></div><button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white"><X className="h-4 w-4" /></button></div>
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-black/20 px-3 py-2 no-scrollbar">{receivers.map((receiver) => { const active = receiver.id === selectedReceiver; const self = receiver.id === profile?.id; return <button key={receiver.id} type="button" onClick={() => setSelectedReceiver(receiver.id)} className={`relative flex shrink-0 flex-col items-center transition ${active ? "scale-105 opacity-100" : "opacity-55"}`}><div className={`relative h-9 w-9 rounded-full p-0.5 ${active ? "bg-gradient-to-tr from-pink-500 to-violet-500 shadow-sm shadow-pink-500/50" : "bg-white/20"}`}><img src={receiver.avatar ?? "https://github.com/shadcn.png"} alt={receiver.username ?? "User"} className="h-full w-full rounded-full object-cover bg-black" /></div><span className="mt-0.5 max-w-[48px] truncate text-[9px] font-medium text-white/80">{self ? "You" : receiver.username ?? "User"}</span></button>; })}{!receivers.length && <span className="text-[10px] text-white/50">No seated users</span>}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{loading ? <div className="grid h-full min-h-[180px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/60" /></div> : <div className="grid grid-cols-5 gap-2">{filtered.map((emoji) => <button key={emoji.id} type="button" onClick={() => pickEmoji(emoji)} className="relative flex aspect-square min-h-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1 active:scale-90" aria-label={emoji.name}><img src={emoji.url || emoji.clip_path} alt={emoji.name} loading="lazy" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-emoji-fallback]"); if (fallback) fallback.style.display = "grid"; }} /><span data-emoji-fallback className="hidden h-full w-full place-items-center text-3xl" role="img" aria-label={emoji.name}>{emoji.emoji}</span><span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-0.5 py-0.5 text-center text-[8px] font-bold text-white">{emoji.name}</span></button>)}</div>}</div>
    </div>
  );
  if (embedded) return content;
  return <div data-jalwa-emoji-sheet="true" className="fixed inset-0 z-[2147483600] flex items-end justify-center bg-black/50 p-0" onClick={onClose} role="dialog" aria-modal="true"><div onClick={(event) => event.stopPropagation()} className="relative flex w-full max-w-lg h-[310px] flex-col overflow-hidden rounded-t-[20px] border border-white/10 bg-[#121212]/95 backdrop-blur-xl text-white shadow-2xl">{content}</div></div>;
}
