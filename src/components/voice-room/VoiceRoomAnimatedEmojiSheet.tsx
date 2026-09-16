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

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: ChatEmoji) => void;
  embedded?: boolean;
};

export function VoiceRoomAnimatedEmojiSheet({ open, onClose, onPick, embedded = false }: Props) {
  const { isAdmin, profile } = useAuth();
  const [list, setList] = useState<ChatEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<"normal" | "vip">("normal");
  const isVip = isAdmin || (profile?.vip_level ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);

    void supabase
      .from("chat_emojis")
      .select("id,slug,emoji,name,category,clip_path,sort_order,tier,min_vip_level")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Emojis load nahi ho sake");
          setList([]);
        } else {
          setList((data ?? []).map((e) => ({ ...(e as ChatEmoji), url: e.clip_path })));
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const filtered = useMemo(
    () => list.filter((e) => (tier === "normal" ? (e.tier ?? "normal") === "normal" : (e.tier ?? "normal") !== "normal")),
    [list, tier],
  );

  if (!open) return null;

  const pickEmoji = (emoji: ChatEmoji) => {
    onPick(emoji);
    onClose();
  };

  const content = (
    <div className="w-full max-h-[68vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Smile className="h-5 w-5 text-amber-400" />
          <p className="text-sm font-bold text-white">Animated Emojis</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white" aria-label="Close emojis">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
        {TIERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.key === "vip" && !isVip) {
                toast.info("👑 VIP emojis VIP members ke liye hain");
                return;
              }
              setTier(item.key);
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${tier === item.key ? "bg-amber-500 text-black" : "bg-white/10 text-white/60"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-[54vh] overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {loading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/60" /></div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                onClick={() => pickEmoji(emoji)}
                className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 transition active:scale-95"
                aria-label={emoji.name}
              >
                <img
                  src={emoji.url || emoji.clip_path}
                  alt={emoji.name}
                  loading="lazy"
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-emoji-fallback]");
                    if (fallback) fallback.style.display = "grid";
                  }}
                />
                <span data-emoji-fallback className="hidden h-full w-full place-items-center text-4xl" role="img" aria-label={emoji.name}>
                  {emoji.emoji}
                </span>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-bold text-white">{emoji.name}</span>
              </button>
            ))}
            {!filtered.length && <p className="col-span-4 py-10 text-center text-xs text-white/50">No emojis here</p>}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div
      data-jalwa-emoji-sheet="true"
      className="fixed inset-0 z-[70] flex items-end bg-black/55"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Animated emojis"
    >
      <div className="w-full" onClick={(event) => event.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
