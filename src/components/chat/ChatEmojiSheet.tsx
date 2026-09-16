import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { VoiceRoomAnimatedEmojiSheet } from "@/components/voice-room/VoiceRoomAnimatedEmojiSheet";

export type ChatEmoji = {
  id: string;
  slug: string;
  emoji: string;
  name: string;
  category: string;
  clip_path: string;
  url?: string;
  sort_order: number;
  tier?: string | null;
  min_vip_level?: number | null;
};

const TIERS: { key: "normal" | "vip"; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "vip", label: "👑 VIP" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (e: ChatEmoji, targetSeatIndex?: number | null) => void;
};

export function ChatEmojiSheet({ open, onClose, onPick }: Props) {
  const { profile, isAdmin } = useAuth();
  const [list, setList] = useState<ChatEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<"normal" | "vip">("normal");
  const isVip = isAdmin || (profile?.vip_level ?? 0) > 0;
  const isVoiceRoom = typeof window !== "undefined" && window.location.pathname.startsWith("/room/");

  useEffect(() => {
    if (isVoiceRoom || !open || list.length > 0) return;
    setLoading(true);
    void supabase
      .from("chat_emojis")
      .select("id,slug,emoji,name,category,clip_path,sort_order,tier,min_vip_level")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Chat emojis load nahi ho sake");
        setList((data ?? []) as ChatEmoji[]);
        setLoading(false);
      });
  }, [isVoiceRoom, open, list.length]);

  const filtered = useMemo(
    () => list.filter((e) => (tier === "normal" ? (e.tier ?? "normal") === "normal" : (e.tier ?? "normal") !== "normal")),
    [list, tier],
  );

  if (isVoiceRoom) return <VoiceRoomAnimatedEmojiSheet open={open} onClose={onClose} onPick={onPick} />;
  if (!open) return null;

  return (
    <div data-jalwa-overlay="true" className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div data-jalwa-overlay-content="true" className="max-h-[70vh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-background" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-bold">Chat Emojis</p>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-card"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
          {TIERS.map((c) => (
            <button key={c.key} type="button" onClick={() => { if (c.key === "vip" && !isVip) { toast.info("👑 VIP emojis VIP members ke liye hain"); return; } setTier(c.key); }} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${tier === c.key ? "bg-[color:var(--primary)] text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}>{c.label}</button>
          ))}
        </div>
        <div className="max-h-[54vh] overflow-y-auto px-3 pb-6">
          {loading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {filtered.map((e) => (
                <button key={e.id} type="button" onClick={() => { onPick(e); onClose(); }} className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-card/60 text-3xl transition active:scale-90" aria-label={e.name}>
                  <span role="img" aria-label={e.name}>{e.emoji}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-5 py-10 text-center text-xs text-muted-foreground">No emojis here</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}