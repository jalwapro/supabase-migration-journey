/**
 * Room Entrance Studio — visual editor plus real render/publish pipeline.
 * Studio settings are saved as render_config; Publish Render bakes those
 * settings into a permanent R2 video and stores its URL on the effect.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import RenderStudio, { type StudioItem } from "@/components/admin/RenderStudio";
import EntrancePublishPanel, { type EntrancePublishItem } from "@/components/admin/EntrancePublishPanel";
import { resolvePlayableGiftUrl } from "@/lib/giftMedia";

export const Route = createFileRoute("/_authenticated/admin/entrance-studio")({
  component: EntranceStudio,
});

type EffectRow = {
  id: string;
  name: string;
  category: string | null;
  media_url: string | null;
  media_type?: string | null;
  duration_ms?: number | null;
  render_config: unknown;
  published_render_url?: string | null;
};

function EntranceStudio() {
  const qc = useQueryClient();

  const { data: effects = [], isLoading } = useQuery({
    queryKey: ["admin", "entrance-studio", "effects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrance_effects")
        .select("id,name,category,media_url,media_type,duration_ms,render_config,published_render_url")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as EffectRow[];
    },
  });

  const items: StudioItem[] = useMemo(
    () => effects.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      clipUrl: resolvePlayableGiftUrl(e.media_url),
      clipType: e.media_type,
      render_config: e.render_config,
    })),
    [effects],
  );

  const publishItems: EntrancePublishItem[] = useMemo(
    () => effects.map((e) => ({
      id: e.id,
      name: e.name,
      mediaUrl: resolvePlayableGiftUrl(e.media_url),
      mediaType: e.media_type,
      durationMs: e.duration_ms,
      renderConfig: e.render_config,
      publishedRenderUrl: e.published_render_url,
    })),
    [effects],
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Entrance Studio" subtitle="Frame, chroma key, colour grade and time every room entrance effect." />
      <RenderStudio
        items={items}
        isLoading={isLoading}
        searchPlaceholder="Search entrances…"
        emptyLabel="No media on this effect"
        onSave={async (id, config) => {
          const { error } = await supabase.from("entrance_effects").update({ render_config: config } as never).eq("id", id);
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ["admin", "entrance-studio", "effects"] });
        }}
      />
      <EntrancePublishPanel items={publishItems} />
    </div>
  );
}
