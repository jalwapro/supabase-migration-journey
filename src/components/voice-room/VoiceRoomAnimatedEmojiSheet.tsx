import { useEffect, useMemo, useState } from "react";
import { Loader2, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChatEmoji } from "@/components/chat/ChatEmojiSheet";

const TIERS: { key: "normal" | "vip"; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "vip", label: "👑 VIP" },
];

export function VoiceRoomAnimatedEmojiSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (emoji: ChatEmoji) => void }) {
  const { profile, isAdmin } = useAuth();
  const [list, setList] = useState<ChatEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<"normal" | "vip">("normal");
  const isVip = isAdmin || (profile?.vip_level ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void supabase
      .from("chat_emojis")
      .select("id,slug,emoji,name,category,clip_path,sort_order,tier,min_vip_level")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Animated emojis load nahi ho sake");
          setList([]);
        } else {
          setList((data ?? []).map((e) => ({ ...(e as ChatEmoji), url: e.clip_path })));
        }
        setLoading(false);
      });
  }, [open]);

  const filtered = useMemo(
    () => list.filter((e) => (tier === "normal" ? (e.tier ?? "normal") === "normal" : (e.tier ?? "normal") !== "normal")),
    [list, tier],
  );

  if (!open) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Smile className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-bold text-white">Animated Emojis</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
        {TIERS.map((item) => (
          <button key={item.key} type="button" onClick={() => { if (item.key === "vip" && !isVip) { toast.info("👑 VIP emojis VIP members ke liye hain"); return; } setTier(item.key); }} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${tier === item.key ? "bg-amber-500 text-black" : "bg-white/10 text-white/60"}`}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/60" /></div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((emoji) => (
              <button key={emoji.id} type="button" onClick={() => onPick(emoji)} className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 transition active:scale-95">
                <img src={emoji.clip_path} alt={emoji.name} loading="lazy" className="h-full w-full object-contain" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-bold text-white">{emoji.name}</span>
              </button>
            ))}
            {!filtered.length && <p className="col-span-4 py-10 text-center text-xs text-white/50">No animated emojis here</p>}
          </div>
        )}
      </div>
    </div>
  );
}
