import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import RenderStudio, { type StudioItem } from "@/components/admin/RenderStudio";
import { resolveAssetUrl } from "@/lib/assetUrl";

export const Route = createFileRoute("/_authenticated/admin/shop-studio")({
  component: ShopStudio,
});

type ThemeRow = {
  id: string;
  name: string;
  category_id: string | null;
  animation_url: string | null;
  preview_url: string | null;
  bg_image: string | null;
  render_config: unknown;
};

type CategoryRow = {
  id: string;
  name: string;
};

function mediaType(url: string | null): string | null {
  if (!url) return null;
  const clean = url.split("#")[0].split("?")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "mp4";
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".mov")) return "mov";
  if (clean.endsWith(".gif")) return "gif";
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "jpg";
  return null;
}

function ShopStudio() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "shop-studio", "themes"],
    queryFn: async () => {
      const [{ data: themes, error: themeError }, { data: categories, error: catError }] = await Promise.all([
        supabase
          .from("themes")
          .select("id,name,category_id,animation_url,preview_url,bg_image,render_config")
          .order("sort"),
        supabase.from("theme_categories").select("id,name").order("sort_order"),
      ]);
      if (themeError) throw themeError;
      if (catError) throw catError;

      const catMap = new Map((categories ?? []).map((c: CategoryRow) => [c.id, c.name]));
      return (themes ?? []).map((t: ThemeRow) => ({
        ...t,
        category: catMap.get(t.category_id ?? "") ?? null,
      }));
    },
  });

  const items: StudioItem[] = useMemo(
    () =>
      rows.map((t) => {
        const source = t.animation_url || t.preview_url || t.bg_image;
        const clipUrl = resolveAssetUrl(source) ?? null;
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          clipUrl,
          clipType: mediaType(clipUrl),
          render_config: t.render_config,
        };
      }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Shop Render Studio"
        subtitle="Cars, frames, rings, entrances and every Shop Item — size, position, chroma key, colour, crop, blur and timing."
      />
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-muted-foreground">
        Manual chroma key: choose the exact background colour yourself. Green, black, white and custom colours are supported; no automatic colour detection is used.
      </div>
      <RenderStudio
        items={items}
        isLoading={isLoading}
        searchPlaceholder="Search Shop Items…"
        emptyLabel="No media on this Shop Item"
        onSave={async (id, config) => {
          const { error } = await supabase
            .from("themes")
            .update({ render_config: config } as never)
            .eq("id", id);
          if (error) throw error;
          await qc.invalidateQueries({ queryKey: ["admin", "shop-studio", "themes"] });
          await qc.invalidateQueries({ queryKey: ["admin_themes"] });
        }}
      />
    </div>
  );
}
