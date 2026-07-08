import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDeviceTilt } from "@/hooks/useDeviceTilt";
import { cn } from "@/lib/utils";

type ThemeRow = {
  id: string;
  bg_image: string | null;
  animation_url: string | null;
  preview_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

export function ThemeBackground() {
  const { profile, loading: authLoading } = useAuth();
  const themeId = profile?.theme_id ?? null;
  const [theme, setTheme] = useState<ThemeRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;

    if (!themeId) {
      setTheme(null);
      setLoading(false);
      if (typeof document !== "undefined") document.body.classList.remove("themed");
      return;
    }

    setLoading(true);
    if (typeof document !== "undefined") document.body.classList.add("themed");

    supabase
      .from("themes")
      .select("id,bg_image,animation_url,preview_url,primary_color,accent_color")
      .eq("id", themeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          const themeData = (data as ThemeRow | null) ?? null;
          setTheme(themeData);
          setLoading(false);
          if (typeof document !== "undefined" && themeData) {
            document.body.classList.add("themed");
          } else {
            document.body.classList.remove("themed");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [themeId, authLoading]);

  if (loading || !theme) return null;

  const media = theme.animation_url || theme.bg_image || theme.preview_url;
  const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
  const fallbackImage = theme.bg_image || theme.preview_url;

  const gradient =
    theme.primary_color && theme.accent_color
      ? `linear-gradient(160deg, ${theme.primary_color}, ${theme.accent_color})`
      : undefined;

  return (
    <ThemeBackgroundInner 
      media={media} 
      isVideo={isVideo} 
      gradient={gradient} 
      fallbackImage={fallbackImage}
    />
  );
}

function ThemeBackgroundInner({
  media,
  isVideo,
  gradient,
  fallbackImage,
}: {
  media: string | null;
  isVideo: boolean;
  gradient: string | undefined;
  fallbackImage: string | null;
}) {
  const { rx, ry } = useDeviceTilt(18);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(!media);
  }, [media]);

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

  const renderMedia = (isDepth = false) => {
    if (!media) return null;
    
    // For depth layer of a video, use the fallback image to save performance and prevent sync flicker
    if (isDepth && isVideo && fallbackImage) {
      return (
        <img
          src={fallbackImage}
          alt=""
          draggable={false}
          decoding="async"
          className="theme-background-media-asset h-full w-full object-cover"
        />
      );
    }

    if (isDepth && isVideo) return null;

    if (isVideo) {
      return (
        <video
          src={media}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onCanPlay={() => setIsLoaded(true)}
          className="theme-background-media-asset h-full w-full object-cover"
        />
      );
    }
    
    return (
      <img 
        src={media} 
        alt="" 
        draggable={false}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className="theme-background-media-asset h-full w-full object-cover" 
      />
    );
  };

  return (
    <div
      aria-hidden
      className={cn(
        "theme-background-root pointer-events-none fixed inset-0 z-0 overflow-hidden",
        isLoaded ? "opacity-100" : "opacity-0"
      )}
      style={{
        background: gradient,
        perspective: "760px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        className="theme-background-stage theme-background-4d theme-background-4d-tilt absolute inset-[-14%] overflow-hidden"
        style={tiltStyle}
      >
        <div className="theme-background-media absolute inset-0">{renderMedia(false)}</div>
        <div className="theme-background-gradient-depth pointer-events-none absolute inset-0" />
        <div className="theme-background-pixels pointer-events-none absolute inset-0" />
        <div className="theme-background-glint pointer-events-none absolute inset-0" />
      </div>
      <div className="theme-background-dim absolute inset-0" />
    </div>
  );
}
