import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDefaultBgOpacity } from "@/hooks/useDefaultBgOpacity";
import defaultBgAsset from "@/assets/jalwa-default-bg.png.asset.json";

const DEFAULT_BG_URL = "https://cloud-to-soul.lovable.app/__l5e/assets-v1/ea572b19-7bc7-48bb-83a7-8fb863e98ef8/jalwa-default-bg.png";


type ThemeRow = {
  id: string;
  bg_image: string | null;
  animation_url: string | null;
  preview_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  category_id?: string | null;
};

/**
 * Apply the user's shop theme as a simple full-cover background across the
 * app. Also injects `--primary` / `--secondary` CSS variables from the
 * theme's colors so buttons, chips, and glows recolor to match.
 *
 * Suppressed on:
 *   - /theme-shop and /admin (so previews show default colors)
 *   - /room/* (room page renders the HOST's theme instead of the viewer's)
 */
export function ThemeBackground() {
  const { profile, loading: authLoading } = useAuth();
  const bgVisibility = useDefaultBgOpacity();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const suppressed =
    pathname.startsWith("/theme-shop") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/room/");
  const themeId = suppressed ? null : profile?.theme_id ?? null;
  const userId = suppressed ? null : profile?.id ?? null;
  const [theme, setTheme] = useState<ThemeRow | null>(null);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const backgroundReady = !suppressed && (!loading || !!customBg);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("theme-background-active", backgroundReady);
    return () => {
      document.body.classList.remove("theme-background-active");
    };
  }, [backgroundReady]);

  // Check for active custom theme (approved + not expired)
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setCustomBg(null);
      return;
    }
    supabase
      .rpc("get_active_custom_theme", { _user: userId })
      .then(({ data }) => {
        if (cancelled) return;
        const row = (Array.isArray(data) ? data[0] : data) as { image_url?: string } | null;
        setCustomBg(row?.image_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;

    if (!themeId) {
      setTheme(null);
      setLoading(false);
      if (typeof document !== "undefined") {
        document.body.classList.remove("themed");
        document.body.style.removeProperty("--primary");
        document.body.style.removeProperty("--secondary");
      }
      return;
    }

    setLoading(true);

    supabase
      .from("themes")
      .select(
        "id,bg_image,animation_url,preview_url,primary_color,accent_color,category_id,theme_categories(slug,name)",
      )
      .eq("id", themeId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const raw = data as
          | (ThemeRow & {
              theme_categories?: { slug: string | null; name: string | null } | null;
            })
          | null;
        const cat = raw?.theme_categories;
        const slug = (cat?.slug ?? "").toLowerCase();
        const name = (cat?.name ?? "").toLowerCase();
        const isThemeCategory =
          !raw?.category_id ||
          slug === "theme" ||
          slug === "themes" ||
          name === "theme" ||
          name === "themes";
        const themeData = isThemeCategory ? (raw as ThemeRow | null) : null;
        setTheme(themeData);
        setLoading(false);
        if (typeof document !== "undefined") {
          if (themeData) {
            document.body.classList.add("themed");
            if (themeData.primary_color)
              document.body.style.setProperty("--primary", themeData.primary_color);
            if (themeData.accent_color)
              document.body.style.setProperty("--secondary", themeData.accent_color);
          } else {
            document.body.classList.remove("themed");
            document.body.style.removeProperty("--primary");
            document.body.style.removeProperty("--secondary");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [themeId, authLoading]);

  // Custom uploaded background takes precedence over shop theme image
  const media = customBg || theme?.bg_image || theme?.preview_url || theme?.animation_url;
  if (suppressed) return null;
  if (loading && !customBg) return null;

  // No shop/custom theme → let the solid app background (light/dark) show.
  if (!media) return null;
  void bgVisibility;
  void DEFAULT_BG_URL;
  void defaultBgAsset;





  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-100",
      )}
    >
      <img
        src={media}
        alt=""
        draggable={false}
        decoding="async"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
