import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Video, Gift } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/jalwa-logo.png";
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


  const videoUrl = cfg.data?.splash_video ?? null;
  const duration = Math.max(1, cfg.data?.splash_duration ?? 3) * 1000;
  const [videoStarted, setVideoStarted] = useState(false);

  function finishVideo() {
    try { sessionStorage.setItem("splash_shown", "1"); } catch { /* no-op */ }
    navigate({ to: "/" });
  }

  // If settings fetch hangs on a slow/offline network, don't trap the user on
  // the black splash screen. Move into the app and let auth hydrate normally.
  useEffect(() => {
    if (!cfg.isLoading) return;
    const t = window.setTimeout(finishVideo, 3500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.isLoading]);

  // Start-watchdog: if the video hasn't begun playing within 10s (bad network
  // / broken file), give up and move on. Once it starts, let it play through
  // to its natural end — no total-duration cap.
  useEffect(() => {
    if (!videoUrl || videoStarted) return;
    const t = window.setTimeout(finishVideo, 10000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, videoStarted]);

  // Fallback progress bar (used when no video)
  useEffect(() => {
    if (videoUrl) return;
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
          playsInline
          preload="auto"
          onEnded={finishVideo}
          onError={finishVideo}
          onCanPlay={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = false;
            v.volume = 1;
            v.play().catch(() => {
              // Browser blocked audio autoplay — fall back to muted playback.
              v.muted = true;
              v.play().catch(() => {});
            });
          }}
          onPlaying={() => setVideoStarted(true)}
          className="h-full max-h-[100dvh] w-full max-w-[480px] object-contain"
        />
        {!videoStarted && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        )}
        <button
          onClick={finishVideo}
          className="absolute bottom-20 right-6 rounded-full bg-white/20 px-5 py-2 text-sm font-bold text-white backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          Skip
        </button>
      </main>
    );
  }

  // Config is still loading — show a plain black screen (no animated fallback)
  // so users never see two splashes back-to-back before the video appears.
  if (cfg.isLoading) {
    return <main className="min-h-[100dvh] bg-black" />;
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
          <img src={cfg.data?.splash_image || logo} alt="Jalwa" className="h-full w-full object-cover" draggable={false} />
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
