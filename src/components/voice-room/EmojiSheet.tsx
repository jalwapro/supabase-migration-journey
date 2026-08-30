import { X } from "lucide-react";

export type VoiceRoomEmoji = {
  id: string;
  emoji: string;
  name?: string;
};

type EmojiSheetProps = {
  open: boolean;
  emojis: VoiceRoomEmoji[];
  onClose: () => void;
  onSelect: (emoji: VoiceRoomEmoji) => void;
};

export function EmojiSheet({ open, emojis, onClose, onSelect }: EmojiSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Animated Emojis"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-[#100719]/98 p-4 pb-7 text-white shadow-2xl backdrop-blur-xl animate-slide-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black">Animated Emojis</h2>
            <p className="text-[10px] text-white/45">Choose an emoji to send in the room</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Close emojis">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid max-h-[55vh] grid-cols-5 gap-2 overflow-y-auto pr-1">
          {emojis.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item)} className="group flex min-h-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 transition hover:scale-105 hover:bg-white/10 active:scale-95" aria-label={item.name || item.emoji}>
              <span className="text-3xl leading-none transition-transform group-hover:scale-110">{item.emoji}</span>
              {item.name ? <span className="mt-1 max-w-full truncate text-[8px] text-white/45">{item.name}</span> : null}
            </button>
          ))}
        </div>
        {!emojis.length && <div className="py-10 text-center text-xs text-white/45">No animated emojis available.</div>}
      </section>
    </div>
  );
}
