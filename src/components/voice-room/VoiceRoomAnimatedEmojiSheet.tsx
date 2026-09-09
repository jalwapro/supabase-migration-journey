import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChatEmoji } from "@/components/chat/ChatEmojiSheet";

const TIERS: { key: "normal" | "vip"; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "vip", label: "👑 VIP" },
];

function playSeatToSeatAnimation(emoji: ChatEmoji, username?: string | null) {
  if (typeof document === "undefined") return;

  // The VoiceRoom target selector marks the selected seat button with an inline
  // background style. Read that selection before the sheet closes.
  const targetButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent?.trim() ?? "";
    return /^Seat\\s+\\d+/i.test(text) && !!button.style.background;
  });

  if (!targetButton) return;

  const targetMatch = targetButton.textContent?.match(/Seat\\s+(\\d+)/i);
  const targetSeat = targetMatch ? Number(targetMatch[1]) - 1 : -1;
  if (targetSeat < 0) return;

  // SeatGrid renders the user's avatar as an img whose alt is the username.
  // Fall back to the selected seat number when the avatar alt is unavailable.
  const senderAvatar = username
    ? Array.from(document.querySelectorAll<HTMLImageElement>("img[alt]")).find((img) => img.alt.trim() === username.trim())
    : null;

  const seatButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter((button) => {
    return Array.from(button.querySelectorAll("span")).some((span) => /^\\d+$/.test(span.textContent?.trim() ?? ""));
  });

  const targetSeatButton = seatButtons.find((button) =>
    Array.from(button.querySelectorAll("span")).some((span) => span.textContent?.trim() === String(targetSeat + 1)),
  );

  const senderRect = (senderAvatar ?? null)?.getBoundingClientRect() ??
    (seatButtons.find((button) =>
      Array.from(button.querySelectorAll("span")).some((span) => span.textContent?.trim() === String(targetSeat + 1)),
    )?.getBoundingClientRect() ?? null);
  const targetRect = (targetSeatButton ?? targetButton).getBoundingClientRect();

  if (!senderRect) return;

  const startX = senderRect.left + senderRect.width / 2;
  const startY = senderRect.top + senderRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;

  const layer = document.createElement("div");
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.zIndex = "2147483646";
  layer.style.pointerEvents = "none";
  layer.setAttribute("data-jalwa-flying-emoji", "true");

  const emojiNode = document.createElement("img");
  emojiNode.src = emoji.url || emoji.clip_path;
  emojiNode.alt = emoji.name || "Animated emoji";
  emojiNode.style.position = "fixed";
  emojiNode.style.left = `${startX - 24}px`;
  emojiNode.style.top = `${startY - 24}px`;
  emojiNode.style.width = "48px";
  emojiNode.style.height = "48px";
  emojiNode.style.objectFit = "contain";
  emojiNode.style.filter = "drop-shadow(0 0 12px rgba(255,215,0,.95))";
  emojiNode.style.willChange = "transform, opacity";
  emojiNode.style.transformOrigin = "50% 50%";

  const targetGlow = document.createElement("div");
  targetGlow.style.position = "fixed";
  targetGlow.style.left = `${endX - 34}px`;
  targetGlow.style.top = `${endY - 34}px`;
  targetGlow.style.width = "68px";
  targetGlow.style.height = "68px";
  targetGlow.style.borderRadius = "9999px";
  targetGlow.style.border = "3px solid rgba(251,191,36,.95)";
  targetGlow.style.boxShadow = "0 0 28px rgba(251,191,36,.9)";
  targetGlow.style.opacity = "0";

  layer.appendChild(targetGlow);
  layer.appendChild(emojiNode);
  document.body.appendChild(layer);

  const flight = emojiNode.animate(
    [
      { transform: "translate3d(0,0,0) scale(.72) rotate(-8deg)", opacity: 0 },
      { transform: `translate3d(${dx * 0.38}px,${dy * 0.38 - 34}px,0) scale(1.12) rotate(8deg)`, opacity: 1, offset: 0.32 },
      { transform: `translate3d(${dx * 0.72}px,${dy * 0.72 + 10}px,0) scale(1.02) rotate(-5deg)`, opacity: 1, offset: 0.72 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(.62) rotate(0deg)`, opacity: 1 },
    ],
    { duration: 980, easing: "cubic-bezier(.22,.75,.25,1)", fill: "forwards" },
  );

  const glow = targetGlow.animate(
    [{ opacity: 0, transform: "scale(.55)" }, { opacity: 0, transform: "scale(.55)" }, { opacity: 1, transform: "scale(1.15)" }, { opacity: 0, transform: "scale(1.45)" }],
    { duration: 360, delay: 900, easing: "ease-out", fill: "forwards" },
  );

  const cleanup = () => {
    flight.cancel();
    glow.cancel();
    layer.remove();
  };
  window.setTimeout(cleanup, 1350);
}

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
              <button key={emoji.id} type="button" onClick={() => { playSeatToSeatAnimation(emoji, profile?.username); onPick(emoji); }} className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 transition active:scale-95">
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
