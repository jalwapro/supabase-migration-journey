/**
 * CamStudio bottom sheet — two tabs: Filters + Beauty.
 * Filters tab shows a small featured row plus a "More" button that
 * expands the full Beauty + Makeup catalog.
 */
import { useMemo, useState } from "react";
import { X, Wand2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { FILTERS, type FilterPreset } from "@/lib/camPipeline/filters";
import { useCamPipeline } from "@/hooks/useCamPipeline";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "filter" | "beauty";

const FEATURED_IDS = ["none", "natural-beauty", "glass-skin", "luxury-glow", "studio-portrait", "hollywood"];

export function CamStudio({ open, onClose }: Props) {
  const { cfg, setFilter, setBeautyOn, setBeautyIntensity } = useCamPipeline();
  const [tab, setTab] = useState<Tab>("filter");
  const [showMore, setShowMore] = useState(false);

  const featured = useMemo(
    () => FEATURED_IDS.map((id) => FILTERS.find((f) => f.id === id)).filter(Boolean) as FilterPreset[],
    [],
  );
  const beautyAll = useMemo(() => FILTERS.filter((f) => f.category === "beauty" && f.id !== "none"), []);
  const makeupAll = useMemo(() => FILTERS.filter((f) => f.category === "makeup"), []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-3xl bg-gradient-to-b from-[#1a0b2e] to-[#0d0620] border-t border-white/10 pb-6 pt-4 px-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-pink-400" /> Camera Studio
          </h2>
          <button onClick={onClose} className="text-white/60 p-1 rounded-full hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 mb-3 bg-white/5 rounded-full p-1">
          <TabBtn active={tab === "filter"} onClick={() => setTab("filter")} icon={<Sparkles className="w-4 h-4" />} label="Filters" />
          <TabBtn active={tab === "beauty"} onClick={() => setTab("beauty")} icon={<Wand2 className="w-4 h-4" />} label="Beauty" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "filter" && (
            <div className="space-y-4">
              {/* Featured */}
              <div>
                <div className="text-white/60 text-[11px] uppercase tracking-wider font-semibold mb-2 px-1">Featured</div>
                <div className="grid grid-cols-4 gap-2">
                  {featured.map((f) => (
                    <FilterCard key={f.id} f={f} active={cfg.filterId === f.id} onClick={() => setFilter(f.id)} />
                  ))}
                </div>
              </div>

              {/* More button */}
              <button
                onClick={() => setShowMore((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-pink-500/20 to-fuchsia-500/20 border border-pink-400/40 text-white text-sm font-medium hover:from-pink-500/30 hover:to-fuchsia-500/30 transition"
              >
                {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showMore ? "Show Less" : "More Filters"}
                <span className="text-white/50 text-xs">({beautyAll.length + makeupAll.length})</span>
              </button>

              {showMore && (
                <>
                  <div>
                    <div className="text-white/60 text-[11px] uppercase tracking-wider font-semibold mb-2 px-1">✨ Beauty</div>
                    <div className="grid grid-cols-4 gap-2">
                      {beautyAll.map((f) => (
                        <FilterCard key={f.id} f={f} active={cfg.filterId === f.id} onClick={() => setFilter(f.id)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-[11px] uppercase tracking-wider font-semibold mb-2 px-1">💄 Makeup</div>
                    <div className="grid grid-cols-4 gap-2">
                      {makeupAll.map((f) => (
                        <FilterCard key={f.id} f={f} active={cfg.filterId === f.id} onClick={() => setFilter(f.id)} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "beauty" && (
            <div className="space-y-4 pt-2">
              <label className="flex items-center justify-between bg-white/5 rounded-2xl p-4">
                <div>
                  <div className="text-white text-sm font-medium">Beauty Filter</div>
                  <div className="text-white/50 text-xs">Smooth skin, brighter face</div>
                </div>
                <input
                  type="checkbox"
                  checked={cfg.beautyOn}
                  onChange={(e) => setBeautyOn(e.target.checked)}
                  className="w-11 h-6 accent-pink-500"
                />
              </label>
              <div className={cn("bg-white/5 rounded-2xl p-4 space-y-2", !cfg.beautyOn && "opacity-40")}>
                <div className="flex items-center justify-between text-white text-sm">
                  <span>Intensity</span>
                  <span className="text-pink-400 font-mono">{Math.round(cfg.beautyIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  disabled={!cfg.beautyOn}
                  value={Math.round(cfg.beautyIntensity * 100)}
                  onChange={(e) => setBeautyIntensity(Number(e.target.value) / 100)}
                  className="w-full accent-pink-500"
                />
              </div>
              <div className="text-white/40 text-xs px-2 leading-relaxed">
                Filter aur beauty dono viewers ko live dikhtay hain. Agar preview slow lagay to Beauty band karke sirf filter chala kar dekh lo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterCard({ f, active, onClick }: { f: FilterPreset; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition p-1",
        active
          ? "border-pink-400 bg-pink-500/20 ring-2 ring-pink-400/50"
          : "border-white/10 bg-white/5 hover:bg-white/10",
      )}
    >
      <span className="text-2xl leading-none">{f.emoji}</span>
      <span className="text-[10px] text-white/80 font-medium text-center leading-tight px-1">{f.label}</span>
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition",
        active ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30" : "text-white/70 hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
