import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, Gift } from "lucide-react";
import { getAssetCacheProgress, subscribeAssetCacheProgress, type AssetCacheProgress } from "@/lib/assetCache";

export const Route = createFileRoute("/splash")({
  component: Splash,
  head: () => ({
    meta: [
      { title: "Jalwa — Live Voice & Chat" },
      {
        name: "description",
        content: "Jalwa: live voice rooms, chat and gifting.",
      },
    ],
  }),
});

function useAssetProgress() {
  const [state, setState] = useState<AssetCacheProgress>(() => getAssetCacheProgress());
  useEffect(() => subscribeAssetCacheProgress(setState), []);
  return state;
}

function Splash() {
  const navigate = useNavigate();
  const embeddedPreview = typeof window !== "undefined" && window.self !== window.top;
  const assetProgress = useAssetProgress();
  const [splashMinDone, setSplashMinDone] = useState(false);

  const assetsReady =
    assetProgress.status === "ready" ||
    assetProgress.status === "offline" ||
    assetProgress.status === "error";

  useEffect(() => {
    const t = window.setTimeout(() => setSplashMinDone(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (embeddedPreview || !splashMinDone || !assetsReady) return;
    try { sessionStorage.setItem("splash_shown", "1"); } catch {}
    navigate({ to: "/", replace: true });
  }, [assetsReady, embeddedPreview, navigate, splashMinDone]);

  useEffect(() => {
    if (embeddedPreview) return;
    const t = window.setTimeout(() => {
      try { sessionStorage.setItem("splash_shown", "1"); } catch {}
      navigate({ to: "/", replace: true });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [embeddedPreview, navigate]);

  useEffect(() => {
    if (!embeddedPreview) return;
    try { sessionStorage.setItem("splash_shown", "1"); } catch {}
    window.location.replace("/?adminPreview=1&customizationMode=design&previewIdentity=neutral");
  }, [embeddedPreview]);

  if (embeddedPreview) {
    return <main className="min-h-[100dvh] bg-background" aria-label="Loading app preview" />;
  }

  const cachePercent = Math.max(0, Math.min(100, assetProgress.percent));
  const cacheDone = assetsReady;
  const cacheLabel =
    assetProgress.status === "offline"
      ? "Offline mode — cached resources available"
      : assetProgress.status === "error"
        ? "Some resources will load online"
        : assetProgress.status === "ready"
          ? "Resources cached and ready"
          : assetProgress.status === "checking"
            ? "Preparing resource download…"
            : "Preparing JALWA resources…";

  return (
    <main
      className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#08050c] px-6 text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 55%, transparent), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--secondary) 55%, transparent), transparent)" }}
      />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
        <div
          className="grid h-28 w-28 place-items-center rounded-[30px] border border-white/10 shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          style={{ background: "linear-gradient(135deg, var(--gold), var(--primary), var(--secondary))" }}
          aria-label="Jalwa"
        >
          <span className="text-4xl font-black tracking-tight text-white">J</span>
        </div>

        <h1 className="mt-6 text-5xl font-black tracking-tight text-white">Jalwa</h1>
        <p className="mt-2 text-sm text-white/60">Live Voice &amp; Chat</p>

        <div className="mt-8 flex items-center gap-10">
          <Feature Icon={Mic} label="Voice" />
          <Feature Icon={Gift} label="Gifts" />
        </div>

        <div className="mt-10 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{
              width: `${cacheDone ? 100 : Math.max(4, cachePercent)}%`,
              background: "linear-gradient(90deg, var(--primary), var(--gold), var(--secondary))",
            }}
          />
        </div>
        <div className="mt-2 text-[10px] font-medium text-white/50">
          {cacheLabel}
        </div>
      </div>

      {assetProgress.total > 0 && !cacheDone && (
        <div className="absolute inset-x-0 bottom-8 z-20 mx-auto w-[min(88vw,360px)] text-center text-[10px] text-white/45">
          {assetProgress.completed} / {assetProgress.total} essential resources
        </div>
      )}
    </main>
  );
}

function Feature({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon className="h-6 w-6 text-white/80" />
      <span className="text-[11px] text-white/55">{label}</span>
    </div>
  );
}
