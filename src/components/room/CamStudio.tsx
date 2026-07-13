/**
 * CamStudio bottom sheet — three tabs (Face stickers, Background, Beauty).
 * Opens from the ✨ button in the video controls of RoomPage.
 */
import { useRef, useState } from "react";
import { X, Upload, Wand2, Image as ImageIcon, Smile } from "lucide-react";
import { STICKERS } from "@/lib/camPipeline/stickers";
import { BACKGROUNDS } from "@/lib/camPipeline/backgrounds";
import { useCamPipeline } from "@/hooks/useCamPipeline";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "face" | "bg" | "beauty";

export function CamStudio({ open, onClose }: Props) {
  const { cfg, setSticker, setBackground, setCustomBg, setBeautyOn, setBeautyIntensity } = useCamPipeline();
  const [tab, setTab] = useState<Tab>("face");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCustomBg(url);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-3xl bg-gradient-to-b from-[#1a0b2e] to-[#0d0620] border-t border-white/10 pb-6 pt-4 px-4 max-h-[75vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-pink-400" /> Camera Studio
          </h2>
          <button onClick={onClose} className="text-white/60 p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 bg-white/5 rounded-full p-1">
          <TabBtn active={tab === "face"} onClick={() => setTab("face")} icon={<Smile className="w-4 h-4" />} label="Face" />
          <TabBtn active={tab === "bg"} onClick={() => setTab("bg")} icon={<ImageIcon className="w-4 h-4" />} label="Background" />
          <TabBtn active={tab === "beauty"} onClick={() => setTab("beauty")} icon={<Wand2 className="w-4 h-4" />} label="Beauty" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "face" && (
            <div className="grid grid-cols-4 gap-2">
              {STICKERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSticker(s.id)}
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition",
                    cfg.stickerId === s.id
                      ? "border-pink-400 bg-pink-500/20 ring-2 ring-pink-400/50"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  )}
                >
                  <span className="text-3xl leading-none">{s.emoji}</span>
                  <span className="text-[10px] text-white/70">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "bg" && (
            <div className="space-y-3">
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full rounded-2xl border p-3 flex items-center gap-3",
                  cfg.customBgUrl
                    ? "border-pink-400 bg-pink-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                {cfg.customBgUrl ? (
                  <img src={cfg.customBgUrl} alt="Custom background preview" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white/70" />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="text-white text-sm font-medium">
                    {cfg.customBgUrl ? "Custom background" : "Upload your image"}
                  </div>
                  <div className="text-white/50 text-xs">JPG or PNG from your device</div>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />

              <div className="grid grid-cols-3 gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBackground(b.id)}
                    className={cn(
                      "aspect-video rounded-xl overflow-hidden relative border transition",
                      cfg.backgroundId === b.id && !cfg.customBgUrl
                        ? "border-pink-400 ring-2 ring-pink-400/50"
                        : "border-white/10 hover:border-white/30",
                    )}
                  >
                    {b.kind === "image" && b.url ? (
                      <img src={b.url} alt={`${b.label} preview`} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn(
                        "w-full h-full flex items-center justify-center text-2xl",
                        b.kind === "blur" ? "bg-gradient-to-br from-blue-500/30 to-purple-500/30 backdrop-blur" : "bg-white/5",
                      )}>
                        {b.emoji}
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                      <div className="text-white text-[10px] font-medium truncate">{b.label}</div>
                    </div>
                  </button>
                ))}
              </div>
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
                Beauty aur filters sab viewers ko live dikhtay hain. Agar preview slow ho to background ko "None" karke sirf sticker chala kar dekh lo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
