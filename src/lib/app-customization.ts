export type AppPage = 'home' | 'voice' | 'video' | 'pk' | 'profile' | 'wallet' | 'navigation' | 'popups';
export type AppConfigStatus = 'draft' | 'published';

export interface AppThemeConfig { primaryColor: string; secondaryColor: string; backgroundColor: string; surfaceColor: string; textColor: string; accentColor: string; borderRadius: number; fontFamily: string; }

export interface AppComponentConfig { id: string; type: string; page: AppPage; x: number; y: number; width: number; height: number; zIndex: number; visible: boolean; locked: boolean; props: Record<string, unknown>; }
export interface AppPageConfig { enabled: boolean; background: string; components: AppComponentConfig[]; }
export interface AppNavigationItem { id: string; label: string; icon: string; visible: boolean; route: string; }

export type HomeSectionId = 'banner' | 'categories' | 'featuredRooms' | 'topHosts' | 'liveRooms';
export interface HomeSectionConfig { id: HomeSectionId; visible: boolean; order: number; title: string; layout: 'full' | 'grid' | 'list'; }

export interface AppCustomizationConfig {
  version: number;
  theme: AppThemeConfig;
  pages: Record<AppPage, AppPageConfig>;
  navigation: AppNavigationItem[];
  homeSections: HomeSectionConfig[];
}

export interface AppCustomizationVersion { id: string; version: number; config: AppCustomizationConfig; changeDescription: string | null; createdBy: string | null; createdAt: string; }

export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: 'banner', visible: true, order: 10, title: 'Banners', layout: 'full' },
  { id: 'categories', visible: true, order: 20, title: 'Categories', layout: 'list' },
  { id: 'featuredRooms', visible: true, order: 30, title: 'Featured Rooms', layout: 'grid' },
  { id: 'topHosts', visible: true, order: 40, title: 'Top Hosts', layout: 'grid' },
  { id: 'liveRooms', visible: true, order: 50, title: 'Live Rooms', layout: 'grid' },
];

export const DEFAULT_APP_CUSTOMIZATION: AppCustomizationConfig = {
  version: 1,
  theme: { primaryColor: '#7c3aed', secondaryColor: '#2563eb', backgroundColor: '#0a0a0f', surfaceColor: '#15151d', textColor: '#ffffff', accentColor: '#ec4899', borderRadius: 12, fontFamily: 'Inter' },
  pages: {
    home: { enabled: true, background: '#0a0a0f', components: [] }, voice: { enabled: true, background: '#0a0a0f', components: [] }, video: { enabled: true, background: '#0a0a0f', components: [] }, pk: { enabled: true, background: '#0a0a0f', components: [] }, profile: { enabled: true, background: '#0a0a0f', components: [] }, wallet: { enabled: true, background: '#0a0a0f', components: [] }, navigation: { enabled: true, background: '#0a0a0f', components: [] }, popups: { enabled: true, background: '#0a0a0f', components: [] },
  },
  navigation: [
    { id: 'home', label: 'Home', icon: 'home', visible: true, route: '/' }, { id: 'rooms', label: 'Rooms', icon: 'mic', visible: true, route: '/rooms' }, { id: 'messages', label: 'Messages', icon: 'message-circle', visible: true, route: '/messages' }, { id: 'wallet', label: 'Wallet', icon: 'wallet', visible: true, route: '/wallet' }, { id: 'profile', label: 'Profile', icon: 'user', visible: true, route: '/profile' },
  ],
  homeSections: DEFAULT_HOME_SECTIONS,
};
