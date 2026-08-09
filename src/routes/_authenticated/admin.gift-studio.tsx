/**
 * Gift Studio — advanced per-gift rendering & video editing.
 * Everything an admin changes here is stored in `gifts.render_config` and is
 * applied live in rooms (snapshotted onto each gift_send) with no code change.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import RenderStudio, { type StudioItem } from "@/components/admin/RenderStudio";
import { resolvePlayableGiftUrl } from "@/lib/giftMedia";

export const Route = createFileRoute("/_authenticated/admin/gift-studio")({
  component: GiftStudio,
});

type GiftRow = {
  id: string;
  name: string;
  category: string;
  clip_path: string | null;
  render_config: unknown;
};

function GiftStudio() {
  const qc = useQueryClient();

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ["admin", "gift-studio", "gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,category,clip_path,render_config")
        .order("price", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as GiftRow[];
    },
  });

  const items: StudioItem[] = useMemo(
    () =>
      gifts.map((g) => ({
        id: g.id,
        name: g.name,
        category: g.category,
        clipUrl: resolvePlayableGiftUrl(g.clip_path),
        render_config: g.render_config,
      })),
    [gifts],
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Gift Studio" subtitle="Size, position, crop, chroma key, colour grade, blur & timing — live, per gift." />
      <RenderStudio
        items={items}
        isLoading={isLoading}
        searchPlaceholder="Search gifts…"
        emptyLabel="No clip on this gift"
        onSave={async (id, config) => {
          const { error } = await supabase.from("gifts").update({ render_config: config } as never).eq("id", id);
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ["admin", "gift-studio", "gifts"] });
        }}
      />
    </div>
  );
}
