export type DeviceKind = 'mobile' | 'tablet' | 'desktop';
export type VersionStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export type AppPageKey =
  | 'home' | 'rooms' | 'voice-room' | 'video-room' | 'pk-battle'
  | 'profile' | 'wallet' | 'messages' | 'ranking' | 'gifts'
  | 'notifications' | 'settings' | 'login' | 'register' | 'splash';

export type ComponentType =
  | 'container' | 'text' | 'heading' | 'image' | 'icon' | 'button' | 'badge'
  | 'divider' | 'spacer' | 'card' | 'avatar' | 'video' | 'banner' | 'carousel'
  | 'grid' | 'list' | 'tabs' | 'modal' | 'popup' | 'progress' | 'counter'
  | 'user-profile-card' | 'live-room-card' | 'voice-room-card' | 'video-room-card'
  | 'pk-battle-card' | 'gift-card' | 'gift-grid' | 'coin-balance' | 'diamond-balance'
  | 'recharge-packages' | 'ranking-list' | 'leaderboard' | 'vip-badge' | 'level-progress'
  | 'user-level' | 'friend-list' | 'chat-list' | 'notification-list' | 'follow-button'
  | 'live-button' | 'create-room-button' | 'pk-battle-button' | 'room-entry-animation'
  | 'gift-animation' | 'room-seat-layout' | 'header' | 'bottom-navigation';

export interface ComponentStyle {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  padding?: string;
  margin?: string;
  background?: string;
  color?: string;
  border?: string;
  borderRadius?: string | number;
  boxShadow?: string;
  opacity?: number;
  transform?: string;
  zIndex?: number;
  display?: string;
  gap?: string | number;
  fontFamily?: string;
  fontSize?: string | number;
  fontWeight?: number | string;
  lineHeight?: string | number;
  letterSpacing?: string | number;
}

export interface VisibilityRule {
  when: 'logged-in' | 'logged-out' | 'vip' | 'admin' | 'host' | 'room-owner' | 'room-live' | 'pk-active' | 'event-active';
  equals?: boolean;
}

export interface ComponentAction {
  type: 'navigate' | 'open-room' | 'open-profile' | 'recharge' | 'send-gift' | 'follow' | 'start-live' | 'create-room' | 'open-chat' | 'open-url' | 'open-popup';
  value?: string;
}

export interface AppComponentNode {
  id: string;
  type: ComponentType;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  props?: Record<string, unknown>;
  style?: ComponentStyle;
  responsive?: Partial<Record<DeviceKind, ComponentStyle>>;
  visibility?: VisibilityRule[];
  action?: ComponentAction;
  children?: AppComponentNode[];
}

export interface AppPageConfig {
  schemaVersion: 1;
  page: AppPageKey;
  theme: string;
  sections: AppComponentNode[];
  navigation?: Record<string, unknown>;
  responsive?: Partial<Record<DeviceKind, Record<string, unknown>>>;
}

export const DEFAULT_APP_CONFIG: AppPageConfig = {
  schemaVersion: 1,
  page: 'home',
  theme: 'default',
  sections: [],
  navigation: {},
  responsive: { mobile: {}, tablet: {}, desktop: {} },
};

export function isSafeComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && ([
    'container','text','heading','image','icon','button','badge','divider','spacer','card','avatar','video','banner','carousel','grid','list','tabs','modal','popup','progress','counter','user-profile-card','live-room-card','voice-room-card','video-room-card','pk-battle-card','gift-card','gift-grid','coin-balance','diamond-balance','recharge-packages','ranking-list','leaderboard','vip-badge','level-progress','user-level','friend-list','chat-list','notification-list','follow-button','live-button','create-room-button','pk-battle-button','room-entry-animation','gift-animation','room-seat-layout','header','bottom-navigation'
  ] as string[]).includes(value);
}

export function normalizePageConfig(raw: unknown, page: AppPageKey): AppPageConfig {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const sections = Array.isArray(source.sections) ? source.sections.filter((node) => {
    if (!node || typeof node !== 'object') return false;
    return isSafeComponentType((node as Record<string, unknown>).type);
  }) as AppComponentNode[] : [];
  return {
    schemaVersion: 1,
    page,
    theme: typeof source.theme === 'string' ? source.theme : 'default',
    sections,
    navigation: source.navigation && typeof source.navigation === 'object' ? source.navigation as Record<string, unknown> : {},
    responsive: source.responsive && typeof source.responsive === 'object' ? source.responsive as AppPageConfig['responsive'] : { mobile: {}, tablet: {}, desktop: {} },
  };
}
