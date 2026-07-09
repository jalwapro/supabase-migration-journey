import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";

export type ChatEmoji = {
  id: string;
  slug: string;
  emoji: string;
  name: string;
  category: string;
  clip_path: string;
  sort_order: number;
};

const CATS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "love", label: "Love" },
  { key: "funny", label: "Funny" },
  { key: "action", label: "Action" },
  { key: "party", label: "Party" },
  { key: "magic", label: "Magic" },
  { key: "cute", label: "Cute" },
];

/** Bottom sheet emoji picker used in DM + Room composers. */
export function ChatEmojiSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: ChatEmoji) => void;
}) {
  const [list, setList] = useState<ChatEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    if (!open || list.length > 0) return;
    setLoading(true);
    void supabase
      .from("chat_emojis")
      .select("id,slug,emoji,name,category,clip_path,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setList((data ?? []) as ChatEmoji[]);
        setLoading(false);
      });
  }, [open, list.length]);

  const filtered = useMemo(
    () => (cat === "all" ? list : list.filter((e) => e.category === cat)),
    [list, cat],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[70vh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-bold">Animated Emojis</p>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-card">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${
                cat === c.key
                  ? "bg-[color:var(--primary)] text-primary-foreground"
                  : "bg-card/60 text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="max-h-[54vh] overflow-y-auto px-3 pb-6">
          {loading ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    onPick(e);
                    onClose();
                  }}
                  className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card/60 p-1 transition active:scale-95"
                >
                  <img
                    src={e.clip_path}
                    alt={e.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[9px] font-bold text-white">
                    {e.name}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-4 py-10 text-center text-xs text-muted-foreground">
                  No emojis here
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
