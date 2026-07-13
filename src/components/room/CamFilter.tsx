import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { X, Sparkles } from "lucide-react";

export type CamFilterId =
  | "none"
  | "beauty"
  | "warm"
  | "cool"
  | "vivid"
  | "mono"
  | "sepia"
  | "dream"
  | "noir"
  | "sunset"
  | "cinema"
  | "bright";

export type CamFilter = {
  id: CamFilterId;
  label: string;
  emoji: string;
  css: string; // CSS filter value
};

export const CAM_FILTERS: CamFilter[] = [
  { id: "none",   label: "Original", emoji: "🚫", css: "none" },
  { id: "beauty", label: "Beauty",   emoji: "✨", css: "contrast(1.05) saturate(1.1) brightness(1.08) blur(0.4px)" },
  { id: "bright", label: "Bright",   emoji: "☀️", css: "brightness(1.18) contrast(1.05) saturate(1.1)" },
  { id: "warm",   label: "Warm",     emoji: "🔥", css: "sepia(0.25) saturate(1.3) hue-rotate(-8deg) brightness(1.05)" },
  { id: "cool",   label: "Cool",     emoji: "❄️", css: "saturate(1.15) hue-rotate(12deg) brightness(1.03) contrast(1.05)" },
  { id: "vivid",  label: "Vivid",    emoji: "🌈", css: "saturate(1.6) contrast(1.15)" },
  { id: "dream",  label: "Dream",    emoji: "💗", css: "contrast(1.05) saturate(1.25) hue-rotate(-15deg) brightness(1.1) blur(0.3px)" },
  { id: "sunset", label: "Sunset",   emoji: "🌅", css: "sepia(0.4) saturate(1.5) hue-rotate(-18deg) brightness(1.05)" },
  { id: "cinema", label: "Cinema",   emoji: "🎬", css: "contrast(1.2) saturate(0.9) brightness(0.95)" },
  { id: "noir",   label: "Noir",     emoji: "🖤", css: "grayscale(1) contrast(1.25) brightness(0.95)" },
  { id: "mono",   label: "Mono",     emoji: "⚫", css: "grayscale(1) contrast(1.05)" },
  { id: "sepia",  label: "Vintage",  emoji: "📻", css: "sepia(0.75) contrast(1.05) brightness(1.02)" },
];

type Ctx = {
  filterId: CamFilterId;
  setFilterId: (id: CamFilterId) => void;
  css: string;
};

const CamFilterCtx = createContext<Ctx>({ filterId: "none", setFilterId: () => {}, css: "none" });

export function CamFilterProvider({ children }: { children: ReactNode }) {
  const [filterId, setFilterId] = useState<CamFilterId>(() => {
    if (typeof window === "undefined") return "none";
    return (window.localStorage.getItem("jalwa:cam_filter") as CamFilterId) || "none";
  });
  const css = useMemo(
    () => CAM_FILTERS.find((f) => f.id === filterId)?.css ?? "none",
    [filterId],
  );
  const value = useMemo<Ctx>(
    () => ({
      filterId,
      css,
      setFilterId: (id) => {
        setFilterId(id);
        try { window.localStorage.setItem("jalwa:cam_filter", id); } catch { /* ignore */ }
      },
    }),
    [filterId, css],
  );
  return <CamFilterCtx.Provider value={value}>{children}</CamFilterCtx.Provider>;
}

export function useCamFilter() {
  return useContext(CamFilterCtx);
}

export function CamFilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filterId, setFilterId } = useCamFilter();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#1a0b2e] to-[#050505] p-4 pb-6 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
            <span className="text-sm font-black">Camera Filter</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {CAM_FILTERS.map((f) => {
            const active = filterId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilterId(f.id)}
                className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition ${
                  active
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/15 shadow-[0_0_16px_-4px_var(--primary)]"
                    : "border-white/10 bg-white/5 hover:border-white/25"
                }`}
              >
                <div
                  className="relative h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-[#3a1a5a] via-[#7a2d6a] to-[#f0c060]"
                  style={{ filter: f.css === "none" ? undefined : f.css }}
                >
                  <span className="absolute inset-0 grid place-items-center text-2xl">{f.emoji}</span>
                </div>
                <span className={`text-[10.5px] font-bold ${active ? "text-white" : "text-white/70"}`}>
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[10.5px] text-white/50">
          Filter aap ki apni screen per lagta hai · sab par visible karnay ke liye future update
        </p>
      </div>
    </div>
  );
}
