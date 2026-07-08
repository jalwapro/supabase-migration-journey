import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDeviceTilt } from "@/hooks/useDeviceTilt";

type ThemeRow = {
  id: string;
  bg_image: string | null;
  animation_url: string | null;
  preview_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

export function ThemeBackground() {
  const { profile } = useAuth();
  const themeId = profile?.theme_id ?? null;
  const [theme, setTheme] = useState<ThemeRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!themeId) {
      setTheme(null);
      if (typeof document !== "undefined") document.body.classList.remove("themed");
      return;
    }
    supabase
      .from("themes")
      .select("id,bg_image,animation_url,preview_url,primary_color,accent_color")
      .eq("id", themeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setTheme((data as ThemeRow | null) ?? null);
          if (typeof document !== "undefined" && data)
            document.body.classList.add("themed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [themeId]);

  if (!theme) return null;
  const media = theme.animation_url || theme.bg_image || theme.preview_url;
  const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
  const gradient =
    theme.primary_color && theme.accent_color
      ? `linear-gradient(160deg, ${theme.primary_color}, ${theme.accent_color})`
      : undefined;

  return <ThemeBackgroundInner media={media} isVideo={isVideo} gradient={gradient} />;
}

function ThemeBackgroundInner({
  media,
  isVideo,
  gradient,
}: {
  media: string | null;
  isVideo: boolean;
  gradient: string | undefined;
}) {
  const { rx, ry, active } = useDeviceTilt(22);
  const tiltStyle = {
    background: gradient,
    "--tilt-rx": `${rx}deg`,
    "--tilt-ry": `${ry}deg`,
    "--tilt-shift-x": `${ry * 1.35}px`,
    "--tilt-shift-y": `${rx * -1.2}px`,
    "--tilt-shift-x-inverse": `${ry * -0.85}px`,
    "--tilt-shift-y-inverse": `${rx * 0.75}px`,
    "--glint-x": `${50 + ry * 1.15}%`,
    "--glint-y": `${50 - rx * 1.25}%`,
  } as CSSProperties;

  const renderMedia = (extraClass = "") => {
    if (!media) return null;
    return isVideo ? (
      <video
        src={media}
        autoPlay
        loop
        muted
        playsInline
        className={`h-full w-full object-cover ${extraClass}`}
      />
    ) : (
      <img src={media} alt="" className={`h-full w-full object-cover ${extraClass}`} />
    );
  };

  return (
    <div
      aria-hidden
      className="theme-background-root pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        background: gradient,
        perspective: "760px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        className={`theme-background-stage absolute inset-[-14%] overflow-hidden ${
          active ? "theme-background-4d theme-background-4d-tilt" : "theme-background-4d theme-background-4d-idle"
        }`}
        style={tiltStyle}
      >
        <div className="theme-background-depth absolute inset-0">{renderMedia()}</div>
        <div className="theme-background-media absolute inset-0">{renderMedia()}</div>
        <div className="theme-background-gradient-depth pointer-events-none absolute inset-0" />
        <div className="theme-background-pixels pointer-events-none absolute inset-0" />
        <div className="theme-background-glint pointer-events-none absolute inset-0" />
      </div>
      <div className="theme-background-dim absolute inset-0" />
    </div>
  );
}
