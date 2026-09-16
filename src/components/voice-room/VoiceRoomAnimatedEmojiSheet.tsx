import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
          const seen = new Set<string>();
          const unique = (data ?? []).filter((row) => {
            const key = row.slug || row.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setList(unique.map((e) => ({ ...(e as ChatEmoji), url: e.clip_path })));
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

  const emojiGrid = (
    <div className="h-[min(38vh,320px)] min-h-[190px] overflow-y-auto overscroll-contain px-2 pb-[max(env(safe-area-inset-bottom),8px)]">
      {loading ? (
        <div className="grid h-full min-h-[190px] place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {filtered.map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              onClick={() => pickEmoji(emoji)}
              className="group relative flex aspect-square min-h-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1 transition active:scale-90"
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
              <span data-emoji-fallback className="hidden h-full w-full place-items-center text-3xl" role="img" aria-label={emoji.name}>
                {emoji.emoji}
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-0.5 py-0.5 text-center text-[8px] font-bold text-white">{emoji.name}</span>
            </button>
          ))}
          {!filtered.length && <p className="col-span-5 py-8 text-center text-xs text-white/50">No emojis here</p>}
        </div>
      )}
    </div>
  );

  // In VoiceRoomScreen the target selector/modal is already present.
  // Embedded mode intentionally contains only the emoji keyboard controls.
  const content = (
    <div className="w-full overflow-hidden">
      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-2 pb-2 no-scrollbar">
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
      {emojiGrid}
    </div>
  );

  if (embedded) return content;

  return (
    <div
      data-jalwa-emoji-sheet="true"
      className="fixed inset-0 z-[70] flex items-center justify-end bg-black/45"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Animated emojis"
    >
      <div
        className="h-[min(58vh,430px)] w-[min(92vw,390px)] max-w-full rounded-l-3xl border border-r-0 border-white/10 bg-slate-950/96 py-2 shadow-2xl backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}
