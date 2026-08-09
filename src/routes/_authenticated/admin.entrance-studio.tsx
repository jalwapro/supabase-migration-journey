/**
 * Room Entrance Studio — same rendering engine as the Gift Studio, applied to
 * `entrance_effects.render_config`. The config is snapshotted onto every
 * room_entrances row so all viewers see the identical framing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import RenderStudio, { type StudioItem } from "@/components/admin/RenderStudio";
import { resolvePlayableGiftUrl } from "@/lib/giftMedia";

export const Route = createFileRoute("/_authenticated/admin/entrance-studio")({
  component: EntranceStudio,
});

type EffectRow = {
  id: string;
  name: string;
  category: string | null;
  media_url: string | null;
  render_config: unknown;
};

function EntranceStudio() {
  const qc = useQueryClient();

  const { data: effects = [], isLoading } = useQuery({
    queryKey: ["admin", "entrance-studio", "effects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrance_effects")
        .select("id,name,category,media_url,render_config")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as EffectRow[];
    },
  });

  const items: StudioItem[] = useMemo(
    () =>
      effects.map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        clipUrl: resolvePlayableGiftUrl(e.media_url),
        render_config: e.render_config,
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
    </div>
  );
}
