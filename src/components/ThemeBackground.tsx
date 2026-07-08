import { useEffect, useState } from "react";
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

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background: gradient,
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {media && (
        <div
          className="shop-theme-3d absolute inset-[-8%] overflow-hidden"
          style={{ background: gradient, willChange: "transform" }}
        >
          {isVideo ? (
            <video
              src={media}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={media} alt="" className="h-full w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-0 shop-theme-shine" />
        </div>
      )}
      <div className="absolute inset-0 bg-background/55" />
    </div>
  );
}
