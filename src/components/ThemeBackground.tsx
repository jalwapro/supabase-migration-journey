import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import jalwaLogo from "@/assets/jalwa-logo.png";

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
  if (loading && !customBg) return null;

  // No custom/shop theme active → render DEFAULT Jalwa theme:
  // deep violet gradient + centered Jalwa logo watermark + gold glow.
  if (!media) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, #2d0b4d 0%, #1a0b2e 45%, #05010a 100%)",
          }}
        />
        <div
          className="absolute -top-24 -left-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #ff2d95, transparent)" }}
        />
        <div
          className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #f5c542, transparent)" }}
        />
        <img
          src={jalwaLogo}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] max-h-[520px] max-w-[520px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.07] mix-blend-screen"
        />
      </div>
    );
  }



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
