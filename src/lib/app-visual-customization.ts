export type AppPageId = 'home' | 'rooms' | 'room' | 'profile' | 'wallet' | 'messages' | 'notifications' | 'pk' | 'search' | 'settings';
export type VisualProperty = 'position' | 'size' | 'spacing' | 'colors' | 'typography' | 'radius' | 'shadow' | 'visibility' | 'content' | 'order';
export type AppVisualElement = {
  id: string;
  page: AppPageId;
  type: string;
  label: string;
  visible: boolean;
  locked: boolean;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: Record<string, string | number | boolean>;
  props?: Record<string, string | number | boolean | null>;
};
export type AppVisualPage = {
  id: AppPageId;
  name: string;
  route: string;
  canvas: { width: number; height: number };
  elements: AppVisualElement[];
};
export type AppVisualDraft = {
  version: number;
  pages: AppVisualPage[];
};

export const APP_PAGE_CATALOG: Array<Pick<AppVisualPage, 'id' | 'name' | 'route'>> = [
  { id: 'home', name: 'Home', route: '/' },
  { id: 'rooms', name: 'Rooms', route: '/rooms' },
  { id: 'room', name: 'Live Room', route: '/room/:roomId' },
  { id: 'profile', name: 'Profile', route: '/profile/:userId' },
  { id: 'wallet', name: 'Wallet', route: '/wallet' },
  { id: 'messages', name: 'Messages', route: '/messages' },
  { id: 'notifications', name: 'Notifications', route: '/notifications' },
  { id: 'pk', name: 'PK Battle', route: '/pk/:roomId' },
  { id: 'search', name: 'Search', route: '/search' },
  { id: 'settings', name: 'Settings', route: '/settings' },
];

export function createEmptyVisualPage(page: Pick<AppVisualPage, 'id' | 'name' | 'route'>): AppVisualPage {
  return { ...page, canvas: { width: 390, height: 844 }, elements: [] };
}

export function createDefaultAppVisualDraft(): AppVisualDraft {
  return { version: 1, pages: APP_PAGE_CATALOG.map(createEmptyVisualPage) };
}
