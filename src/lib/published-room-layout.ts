import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PK_LAYOUT, DEFAULT_VIDEO_LAYOUT, DEFAULT_VOICE_LAYOUT, type LayoutJSON, type RoomType } from './room-layouts';

const FALLBACKS: Record<RoomType, LayoutJSON> = { voice: DEFAULT_VOICE_LAYOUT, video: DEFAULT_VIDEO_LAYOUT, pk: DEFAULT_PK_LAYOUT };

export async function loadPublishedRoomLayout(roomType: RoomType): Promise<LayoutJSON> {
  const { data, error } = await supabase
    .from('room_layouts')
    .select('layout_json')
    .eq('type', roomType)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.layout_json || typeof data.layout_json !== 'object') return FALLBACKS[roomType];
  return data.layout_json as LayoutJSON;
}
