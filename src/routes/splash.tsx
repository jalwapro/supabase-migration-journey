import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, Video, Gift } from "lucide-react";
import logo from "@/assets/jalwa-logo.png.asset.json";

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

function Splash() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 2400;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else navigate({ to: "/" });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [navigate]);

  return (
    <main
      className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-6"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 55%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--secondary) 55%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--gold) 45%, transparent), transparent)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
        <div
          className="relative h-32 w-32 overflow-hidden rounded-[28px] border border-border shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          style={{
            background:
              "linear-gradient(135deg, var(--gold), var(--primary), var(--secondary))",
          }}
        >
          <img
            src={logo.url}
            alt="Jalwa"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <h1 className="mt-6 text-5xl font-black tracking-tight text-gradient">
          Jalwa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live Voice &amp; Video Party
        </p>

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
              background:
                "linear-gradient(90deg, var(--primary), var(--gold), var(--secondary))",
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
