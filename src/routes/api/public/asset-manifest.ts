import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "../../../integrations/supabase/client.server";

type Row = Record<string, unknown>;

const TYPE_RE = /\.(mp4|webm|mov|svga|mp3|wav|ogg|m4a|png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const toType = (url: string): "image" | "video" | "audio" | "other" => {
  if (/\.(mp4|webm|mov|svga)$/i.test(url)) return "video";
  if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) return "audio";
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url)) return "image";
  return "other";
};

function add(out: Map<string, any>, table: string, row: Row, column: string, priority: number) {
  const raw = row[column];
  if (typeof raw !== "string" || !raw.trim()) return;
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) return;
  if (!TYPE_RE.test(url)) return;
  const id = `${table}:${String(row.id ?? row.name ?? row.slug ?? url)}:${column}`;
  const version = String(row.updated_at ?? row.version ?? row.id ?? url);
  const old = out.get(url);
  if (!old || priority > old.priority) out.set(url, { id, url, version, type: toType(url), priority });
}

async function rows(table: string, columns: string[]) {
  const { data, error } = await supabaseAdmin.from(table).select(["id", "updated_at", ...columns].join(",")).limit(1000);
  if (error) return [];
  return (data ?? []) as Row[];
}

export const Route = createFileRoute("/api/public/asset-manifest")({
  server: {
    handlers: {
      GET: async () => {
        const out = new Map<string, any>();

        const configs: Array<[string, string[], number]> = [
          ["gifts", ["icon_path","clip_path","image_url","sound_url","audio_url","thumb_url","preview_url"], 100],
          ["dp_frames", ["image_url","thumbnail_url"], 90],
          ["profile_cards", ["bg_media_url","thumbnail_url","frame_media_url"], 85],
          ["room_entrances", ["media_url","sound_url","avatar_url","published_render_url"], 80],
          ["entrance_effects", ["media_url","thumbnail_url","sound_url","landscape_url","webm_url","published_render_url"], 80],
          ["room_top_frames", ["media_url"], 75],
          ["room_backgrounds", ["image_url"], 70],
          ["themes", ["bg_image","preview_url","animation_url"], 65],
          ["vip_level_config", ["badge_url","frame_url","bubble_url","entrance_url","popup_frame_url","profile_card_bg_url"], 60],
          ["spotlight_animations", ["overlay_asset_url","bg_animation_url"], 55],
          ["room_slides", ["image_url"], 50],
          ["banners", ["image","image_url"], 45],
          ["custom_themes", ["image_url"], 40],
          ["theme_categories", ["icon_url"], 35],
          ["app_customization_assets", ["public_url"], 30],
          ["ads", ["image_url"], 25],
        ];

        await Promise.all(configs.map(async ([table, columns, priority]) => {
          for (const row of await rows(table, columns)) {
            for (const column of columns) add(out, table, row, column, priority);
          }
        }));

        const assets = [...out.values()].sort((a, b) => b.priority - a.priority);
        return new Response(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), assets }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});
