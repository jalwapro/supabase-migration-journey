import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MOCK_GIFTS, type GiftItem } from "./types";

const CATEGORIES: { id: GiftItem["category"]; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "romantic", label: "Romantic" },
  { id: "luxury", label: "Luxury" },
  { id: "fun", label: "Fun" },
];

interface VoiceRoomGiftSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverName: string;
  onSendGift: (gift: GiftItem) => void;
}

export function VoiceRoomGiftSheet({ open, onOpenChange, receiverName, onSendGift }: VoiceRoomGiftSheetProps) {
  const [category, setCategory] = useState<GiftItem["category"]>("popular");
  const [selected, setSelected] = useState<GiftItem>(MOCK_GIFTS[0]);
  const gifts = MOCK_GIFTS.filter((g) => g.category === category);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-[#0b0710] p-0 text-white" data-adaptive="neon" data-live-component="voice.gift-sheet" data-live-component-instance="0">
        <SheetHeader className="border-b border-white/10 px-4 py-3" data-live-component="voice.gift-sheet.header" data-live-component-instance="0">
          <SheetTitle className="text-sm text-white/85">Send a gift to {receiverName}</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2" data-live-component="voice.gift-sheet.categories" data-live-component-instance="0">
          {CATEGORIES.map((c) => <button key={c.id} onClick={() => setCategory(c.id)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors", category === c.id ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.03] text-white/50")}>{c.label}</button>)}
        </div>
        <div className="grid max-h-[45vh] grid-cols-4 gap-2 overflow-y-auto px-4 py-2 sm:grid-cols-6" data-live-component="voice.gift-sheet.grid" data-live-component-instance="0">
          {gifts.map((g) => <button key={g.id} onClick={() => setSelected(g)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors", selected.id === g.id ? "border-fuchsia-400/60 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]")}>{g.icon}<span className="truncate text-[10px] text-white/75">{g.name}</span><span className="text-[10px] font-semibold text-amber-300">{g.price}</span></button>)}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3" data-live-component="voice.gift-sheet.footer" data-live-component-instance="0">
          <div className="flex items-center gap-2 text-xs text-white/60"><span className="text-xl">{selected.icon}</span>{selected.name} · <span className="font-semibold text-amber-300">{selected.price} coins</span></div>
          <button onClick={() => onSendGift(selected)} className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-2 text-xs font-bold text-white shadow-[0_0_16px_-4px_rgba(232,60,220,0.8)] transition-transform active:scale-95">Send Gift</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
