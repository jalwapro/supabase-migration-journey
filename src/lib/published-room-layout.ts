import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PK_LAYOUT, DEFAULT_VIDEO_LAYOUT, DEFAULT_VOICE_LAYOUT, type LayoutJSON, type RoomType } from './room-layouts';

const FALLBACKS: Record<RoomType, LayoutJSON> = { voice: DEFAULT_VOICE_LAYOUT, video: DEFAULT_VIDEO_LAYOUT, pk: DEFAULT_PK_LAYOUT };

export async function loadPublishedRoomLayout(roomId: string, roomType: RoomType): Promise<LayoutJSON> {
  if (!roomId) return FALLBACKS[roomType];
  const { data, error } = await supabase.rpc('get_room_layout', { p_room_id: roomId, p_type: roomType });
  if (error || !data || typeof data !== 'object') return FALLBACKS[roomType];
  const layout = data as LayoutJSON;
  if (!layout.canvas || !Array.isArray(layout.elements)) return FALLBACKS[roomType];
  return layout;
}
