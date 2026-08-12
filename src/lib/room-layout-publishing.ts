import { supabase } from '@/integrations/supabase/client';
import type { LayoutJSON, RoomType } from './room-layouts';

export async function publishRoomLayout(layoutId: string, layout: LayoutJSON, type: RoomType) {
  const now = new Date().toISOString();
  const { data: current, error: currentError } = await supabase.from('room_layouts').select('version').eq('id', layoutId).single();
  if (currentError) throw currentError;
  const nextVersion = Math.max(1, Number(current?.version ?? 0) + 1);

  const { error: unpublishError } = await supabase.from('room_layouts').update({ status: 'draft', published_at: null, updated_at: now }).eq('type', type).eq('status', 'published').neq('id', layoutId);
  if (unpublishError) throw unpublishError;

  const { data, error } = await supabase.from('room_layouts').update({ layout_json: layout, type, version: nextVersion, status: 'published', published_at: now, updated_at: now }).eq('id', layoutId).select().single();
  if (error) throw error;

  const { error: versionError } = await supabase.from('room_layout_versions').insert({ layout_id: layoutId, version: nextVersion, layout_json: layout, change_description: 'Published from Room Layout Studio' });
  if (versionError) throw versionError;

  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('jalwa:room-layout-published', { detail: { layoutId, roomType: type, version: nextVersion } }));
  return data;
}
