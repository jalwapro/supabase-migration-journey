import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Video, Gift } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/jalwa-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/splash")({
  component: Splash,
  head: () => ({
    meta: [
      { title: "Jalwa — Live Voice & Video Party" },
      {
        name: "description",
        content:
          "Jalwa: live voice and video party rooms. Create, share, and shine with gifts and games.",
      },
      { property: "og:title", content: "Jalwa — Live Voice & Video Party" },
      {
        property: "og:description",
        content: "Join live voice & video rooms. Send gifts. Play games.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type SplashCfg = {
  splash_enabled: boolean;
  splash_video: string | null;
  splash_video_poster: string | null;
  splash_image: string | null;
  splash_duration: number;
};

function Splash() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const cfg = useQuery({
    queryKey: ["splash_cfg"],
    queryFn: async () => {
      // Progressive fallback: some deployments may not have every splash column yet.
      const attempts = [
        "splash_enabled,splash_video,splash_video_poster,splash_image,splash_duration",
        "splash_video,splash_video_poster,splash_image",
        "splash_image",
      ];
      for (const cols of attempts) {
        const { data, error } = await supabase
          .from("app_settings")
          .select(cols)
          .eq("id", "global")
          .maybeSingle();
        if (!error) return (data ?? null) as unknown as SplashCfg | null;
      }
      return null;
    },
    staleTime: 60_000,
    retry: false,
  });


  // Detect slow / data-saver networks so we don't force a big video download.
  const slowNetwork = (() => {
    if (typeof navigator === "undefined") return false;
    const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!c) return false;
    if (c.saveData) return true;
    return c.effectiveType === "2g" || c.effectiveType === "slow-2g" || c.effectiveType === "3g";
  })();

  const videoUrl = !slowNetwork ? (cfg.data?.splash_video ?? null) : null;
  const duration = Math.max(1, cfg.data?.splash_duration ?? 3) * 1000;

  function finishVideo() {
    try { sessionStorage.setItem("splash_shown", "1"); } catch { /* no-op */ }
    navigate({ to: "/" });
  }

  // Hard cap: never keep the user on splash for more than 6s total, even if
  // the video is still buffering on a slow connection.
  useEffect(() => {
    if (!videoUrl) return;
    const t = window.setTimeout(finishVideo, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // Fallback progress bar (used when no video, or before video plays)
  useEffect(() => {
    if (videoUrl) return; // video onEnded handles nav
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        try { sessionStorage.setItem("splash_shown", "1"); } catch { /* no-op */ }
        navigate({ to: "/" });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [navigate, duration, videoUrl]);

  if (videoUrl) {
    return (
      <main
        className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-black"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={cfg.data?.splash_video_poster ?? undefined}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={finishVideo}
          onError={finishVideo}
          onCanPlay={() => { void videoRef.current?.play().catch(() => {}); }}
          className="h-full max-h-[100dvh] w-full max-w-[480px] object-cover"
        />
        <button
          onClick={finishVideo}
          className="absolute bottom-6 right-6 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur"
        >
          Skip
        </button>
      </main>
    );
  }

  return (
    <main
      className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-6"
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
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--gold) 45%, transparent), transparent)" }}
      />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
        <div
          className="relative h-32 w-32 overflow-hidden rounded-[28px] border border-border shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          style={{ background: "linear-gradient(135deg, var(--gold), var(--primary), var(--secondary))" }}
        >
          <img src={cfg.data?.splash_image || logo.url} alt="Jalwa" className="h-full w-full object-cover" draggable={false} />
        </div>

        <h1 className="mt-6 text-5xl font-black tracking-tight text-gradient">Jalwa</h1>
        <p className="mt-2 text-sm text-muted-foreground">Live Voice &amp; Video Party</p>

        <div className="mt-8 flex items-center gap-8">
          <Feature Icon={Mic} label="Voice" color="var(--secondary)" />
          <Feature Icon={Video} label="Video" color="var(--primary)" />
          <Feature Icon={Gift} label="Gifts" color="var(--gold)" />
        </div>

        <div className="mt-10 h-1.5 w-40 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: "linear-gradient(90deg, var(--primary), var(--gold), var(--secondary))",
            }}
          />
        </div>
      </div>
    </main>
  );
}

function Feature({
  Icon,
  label,
  color,
}: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon className="h-6 w-6" style={{ color }} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
