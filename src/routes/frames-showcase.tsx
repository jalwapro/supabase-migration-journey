import { createFileRoute } from "@tanstack/react-router";
import { JalwaFrame, JALWA_FRAME_CATEGORIES } from "@/components/frames/JalwaFrame";

export const Route = createFileRoute("/frames-showcase")({
  head: () => ({
    meta: [
      { title: "DP Frames — Jalwa Live" },
      { name: "description", content: "Premium DP frame collection: Basic, Silver, Gold, Diamond, Crown, Royal, VIP, Agency, PK Champion, Legendary, Chakoor, and Jalwa Exclusive." },
      { property: "og:title", content: "Jalwa DP Frames — Premium Collection" },
      { property: "og:description", content: "18 luxury vector avatar frames with crystal shine, crown glow, and neon aura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FramesShowcase,
});

function FramesShowcase() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-[480px] px-4 py-6">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight">DP Frame Collection</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            18 vector frames · retina-crisp · perfect alignment
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {JALWA_FRAME_CATEGORIES.map((c) => (
            <div
              key={c.key}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4"
            >
              <div className="flex items-center justify-center">
                <JalwaFrame category={c.key} size={112} label={c.label}>
                  <div className="grid h-full w-full place-items-center text-lg font-black text-white/90">
                    J
                  </div>
                </JalwaFrame>
              </div>
              <div className="mt-3 text-center">
                <div className="text-sm font-bold">{c.label}</div>
                <div className="text-[10px] text-muted-foreground">{c.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
