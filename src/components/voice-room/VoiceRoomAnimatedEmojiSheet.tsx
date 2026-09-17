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

function avatarRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  const avatar = element.querySelector<HTMLElement>("img[alt], img, [data-avatar], video");
  const rect = (avatar ?? element).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function findSender(senderId?: string | null, username?: string | null) {
  if (senderId) {
    const seat = document.querySelector<HTMLElement>(`[data-user-dp="${CSS.escape(senderId)}"]`);
    if (seat) return seat;
  }
  if (username) {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-user-dp]"))
      .find((seat) => Array.from(seat.querySelectorAll<HTMLImageElement>("img[alt]"))
        .some((img) => img.alt.trim() === username.trim())) ?? null;
  }
  return null;
}

function playSeatToSeatAnimation(emoji: ChatEmoji, targetSeatIndex: number | null, senderId?: string | null, username?: string | null) {
  if (typeof document === "undefined" || targetSeatIndex == null) return;
  const startedAt = performance.now();
  const attempt = () => {
    const targetSeat = document.querySelector<HTMLElement>(`[data-seat-index="${targetSeatIndex}"]`);
    const senderSeat = findSender(senderId, username);
    const senderRect = avatarRect(senderSeat);
    const targetRect = avatarRect(targetSeat);
    if (!senderRect || !targetRect) {
      if (performance.now() - startedAt < 4000) window.requestAnimationFrame(attempt);
      return;
    }
    const startX = senderRect.left + senderRect.width / 2;
    const startY = senderRect.top + senderRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none", overflow: "visible" });
    layer.dataset.jalwaFlyingEmoji = "true";
    const node = document.createElement("div");
    Object.assign(node.style, { position: "fixed", left: `${startX - 30}px`, top: `${startY - 30}px`, width: "60px", height: "60px", display: "grid", placeItems: "center", fontSize: "44px", lineHeight: "1", opacity: "1", willChange: "transform,opacity", pointerEvents: "none", isolation: "isolate" });
    const fallback = document.createElement("span");
    fallback.textContent = emoji.emoji || "✨";
    Object.assign(fallback.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", fontSize: "44px", lineHeight: "1", zIndex: "0", filter: "drop-shadow(0 0 10px rgba(255,215,0,.95))" });
    node.appendChild(fallback);
    const src = emoji.url || emoji.clip_path || "";
    if (src) {
      const img = document.createElement("img");
      img.alt = emoji.name || "Animated emoji";
      Object.assign(img.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", display: "block", zIndex: "1", pointerEvents: "none", filter: "drop-shadow(0 0 10px rgba(255,215,0,.95))" });
      img.onerror = () => img.remove();
      img.src = src;
      node.appendChild(img);
    }
    layer.appendChild(node);
    document.body.appendChild(layer);
    const keyframes = [
      { transform: "translate3d(0,0,0) scale(.55) rotate(-10deg)", opacity: 1 },
      { transform: `translate3d(${dx * .35}px,${dy * .35 - 30}px,0) scale(1.2) rotate(10deg)`, opacity: 1, offset: .3 },
      { transform: `translate3d(${dx * .72}px,${dy * .72 + 8}px,0) scale(1.05) rotate(-5deg)`, opacity: 1, offset: .7 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(.7)`, opacity: 1 },
    ];
    let animation: Animation | null = null;
    try {
      animation = node.animate(keyframes, { duration: 1000, easing: "cubic-bezier(.22,.75,.25,1)", fill: "forwards" });
    } catch {
      node.style.transform = `translate3d(${dx}px,${dy}px,0) scale(.7)`;
    }
    const impact = document.createElement("div");
    Object.assign(impact.style, { position: "fixed", left: `${endX - 32}px`, top: `${endY - 32}px`, width: "64px", height: "64px", borderRadius: "50%", border: "3px solid rgba(251,191,36,.95)", boxShadow: "0 0 28px rgba(251,191,36,.9)", opacity: "0", pointerEvents: "none" });
    layer.appendChild(impact);
    const impactAnimation = impact.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 300, delay: 950, easing: "ease-out", fill: "forwards" });
    window.setTimeout(() => { animation?.cancel(); impactAnimation.cancel(); layer.remove(); }, 1400);
  };
  attempt();
}

function syncLegacyTargetSeat(targetSeatIndex: number) {
  if (typeof document === "undefined") return;
  const label = `Seat ${targetSeatIndex + 1}`;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(label));
  button?.click();
}

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
    setLoading(true);
    const roomId = typeof window !== "undefined" ? window.location.pathname.match(/^\/room\/([^/]+)/)?.[1] : null;
    const load = async () => {
      const [{ data: emojis, error: emojiError }, { data: members, error: memberError }] = await Promise.all([
        supabase.from("chat_emojis").select("id,slug,emoji,name,category,clip_path,sort_order,tier,min_vip_level").eq("is_active", true).order("sort_order", { ascending: true }),
        roomId ? supabase.from("room_members").select("user_id,seat_index,profiles(id,username,avatar)").eq("room_id", roomId).not("seat_index", "is", null).order("seat_index", { ascending: true }) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (!active) return;
      if (emojiError) { toast.error("Emojis load nahi ho sake"); setList([]); } else {
        const seen = new Set<string>();
        setList((emojis ?? []).filter((row) => { const key = row.slug || row.id; if (seen.has(key)) return false; seen.add(key); return true; }).map((e) => ({ ...(e as ChatEmoji), url: e.clip_path })));
      }
      if (memberError) { toast.error("Room users load nahi ho sake"); setReceivers([]); } else {
        setReceivers((members ?? []).map((m: any) => ({ id: m.profiles?.id || m.user_id, username: m.profiles?.username || "User", avatar: m.profiles?.avatar || null, seat_index: m.seat_index })).filter((r: EmojiReceiver) => r.seat_index != null));
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

    // The parent VoiceRoomScreen still has legacy target-seat state. Its React
    // state update from the synthetic seat click is committed after this event,
    // so hand the target to the parent on the next task. This keeps the new UX
    // (receiver selection inside this sheet) while making the old callback see
    // the selected seat and avoiding the legacy "select a seat first" toast.
    syncLegacyTargetSeat(targetSeat);
    playSeatToSeatAnimation(emoji, targetSeat, profile?.id, profile?.username);
    window.setTimeout(() => {
      onPick(emoji, targetSeat);
      onClose();
    }, 0);
  };

  const content = (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-3 py-2"><div className="flex items-center gap-1.5"><Smile className="h-4 w-4 text-amber-400" /><span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">Animated Emojis</span><div className="flex gap-1">{TIERS.map((item) => <button key={item.key} type="button" onClick={() => { if (item.key === "vip" && !isVip) { toast.info("👑 VIP emojis VIP members ke liye hain"); return; } setTier(item.key); }} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tier === item.key ? "bg-gradient-to-r from-pink-500 to-violet-600 text-white" : "bg-white/10 text-white/70"}`}>{item.label}</button>)}</div></div><button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white"><X className="h-4 w-4" /></button></div>
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-black/20 px-3 py-2 no-scrollbar">{receivers.map((receiver) => { const active = receiver.id === selectedReceiver; const self = receiver.id === profile?.id; return <button key={receiver.id} type="button" onClick={() => setSelectedReceiver(receiver.id)} className={`relative flex shrink-0 flex-col items-center transition ${active ? "scale-105 opacity-100" : "opacity-55"}`}><div className={`relative h-9 w-9 rounded-full p-0.5 ${active ? "bg-gradient-to-tr from-pink-500 to-violet-500 shadow-sm shadow-pink-500/50" : "bg-white/20"}`}><img src={receiver.avatar ?? "https://github.com/shadcn.png"} alt={receiver.username ?? "User"} className="h-full w-full rounded-full object-cover bg-black" /></div><span className="mt-0.5 max-w-[48px] truncate text-[9px] font-medium text-white/80">{self ? "You" : receiver.username ?? "User"}</span></button>; })}{!receivers.length && <span className="text-[10px] text-white/50">No seated users</span>}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{loading ? <div className="grid h-full min-h-[180px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/60" /></div> : <div className="grid grid-cols-5 gap-2">{filtered.map((emoji) => <button key={emoji.id} type="button" onClick={() => pickEmoji(emoji)} className="relative flex aspect-square min-h-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1 active:scale-90" aria-label={emoji.name}><img src={emoji.url || emoji.clip_path} alt={emoji.name} loading="lazy" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-emoji-fallback]"); if (fallback) fallback.style.display = "grid"; }} /><span data-emoji-fallback className="hidden h-full w-full place-items-center text-3xl" role="img" aria-label={emoji.name}>{emoji.emoji}</span><span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-0.5 py-0.5 text-center text-[8px] font-bold text-white">{emoji.name}</span></button>)}</div>}</div>
    </div>
  );
  if (embedded) return content;
  return <div className="fixed inset-0 z-[2147483600] flex items-end justify-center bg-black/50 p-0" onClick={onClose} role="dialog" aria-modal="true"><div onClick={(event) => event.stopPropagation()} className="relative flex w-full max-w-lg h-[310px] flex-col overflow-hidden rounded-t-[20px] border border-white/10 bg-[#121212]/95 backdrop-blur-xl text-white shadow-2xl">{content}</div></div>;
}