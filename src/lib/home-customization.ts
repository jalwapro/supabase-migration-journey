import { loadPublishedAppCustomization } from './published-app-customization';

export type HomeSectionId = 'banner' | 'live_users' | 'tabs' | 'top_hosts' | 'live_rooms';
export interface HomeSectionSetting { id: HomeSectionId; visible: boolean; title: string; order: number; layout: 'grid' | 'list' | 'slider'; }

export const DEFAULT_HOME_SECTIONS: HomeSectionSetting[] = [
  { id: 'banner', visible: true, title: 'Banner', order: 10, layout: 'slider' },
  { id: 'live_users', visible: true, title: 'Live now', order: 20, layout: 'slider' },
  { id: 'tabs', visible: true, title: 'Rooms', order: 30, layout: 'list' },
  { id: 'top_hosts', visible: true, title: 'Top Hosts', order: 40, layout: 'grid' },
  { id: 'live_rooms', visible: true, title: 'All Live Rooms', order: 50, layout: 'list' },
];

export async function loadHomeSectionSettings(): Promise<HomeSectionSetting[]> {
  const config = await loadPublishedAppCustomization();
  const remote = (config.pages.home?.components ?? []).find((item) => item.type === 'home-sections')?.props?.sections;
  if (!Array.isArray(remote)) return DEFAULT_HOME_SECTIONS;
  const byId = new Map(remote.map((value) => [String((value as Record<string, unknown>).id), value as Record<string, unknown>]));
  return DEFAULT_HOME_SECTIONS.map((base) => ({
    ...base,
    ...(byId.get(base.id) ?? {}),
  })).sort((a, b) => a.order - b.order);
}
