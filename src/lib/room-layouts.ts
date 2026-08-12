// ============================================
// ROOM LAYOUT SYSTEM - TYPE DEFINITIONS
// ============================================

export type RoomType = 'voice' | 'video' | 'pk';
export type LayoutStatus = 'draft' | 'published' | 'archived';

export type ElementType =
  | 'background'
  | 'room-header'
  | 'room-title'
  | 'room-id'
  | 'host-avatar'
  | 'host-name'
  | 'seat'
  | 'seat-avatar'
  | 'seat-frame'
  | 'seat-number'
  | 'seat-lock'
  | 'mic-icon'
  | 'user-level'
  | 'user-name'
  | 'online-indicator'
  | 'room-announcement'
  | 'chat-panel'
  | 'chat-message'
  | 'gift-button'
  | 'gift-panel'
  | 'send-gift-button'
  | 'coin-balance'
  | 'follow-button'
  | 'share-button'
  | 'more-button'
  | 'close-button'
  | 'settings-button'
  | 'room-info'
  | 'bottom-toolbar'
  | 'beauty-filter-button'
  | 'game-button'
  | 'pk-button'
  | 'video-participant'
  | 'video-frame'
  | 'pk-player'
  | 'pk-vs-logo'
  | 'pk-score-bar'
  | 'pk-progress-bar'
  | 'pk-timer'
  | 'pk-gift-score'
  | 'pk-coin-score'
  | 'pk-battle-status'
  | 'pk-winner-area'
  | 'custom-image'
  | 'custom-text'
  | 'decorative-element'
  | 'divider'
  | 'overlay'
  | 'gradient'
  | 'badge'
  | 'frame'
  | 'gif-animation';

export interface LayoutElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  rotation?: number;
  scale?: number;
  opacity?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  style?: {
    border?: string;
    boxShadow?: string;
    background?: string;
    gradient?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    letterSpacing?: number;
    color?: string;
  };
  data?: Record<string, unknown>; // Element-specific data
}

export interface LayoutCanvas {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: string;
}

export interface LayoutJSON {
  version: number;
  canvas: LayoutCanvas;
  background?: {
    type: 'image' | 'color' | 'gradient';
    value: string;
  };
  elements: LayoutElement[];
}

export interface RoomLayout {
  id: string;
  name: string;
  type: RoomType;
  description: string | null;
  layout_json: LayoutJSON;
  thumbnail: string | null;
  status: LayoutStatus;
  version: number;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface RoomLayoutVersion {
  id: string;
  layout_id: string;
  version: number;
  layout_json: LayoutJSON;
  thumbnail: string | null;
  change_description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RoomLayoutTemplate {
  id: string;
  name: string;
  type: RoomType;
  description: string | null;
  layout_json: LayoutJSON;
  thumbnail: string | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomLayoutAssignment {
  id: string;
  room_id: string;
  layout_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
}

export interface CategoryLayoutAssignment {
  id: string;
  category: string;
  type: RoomType;
  layout_id: string | null;
  priority: number;
  assigned_at: string;
  assigned_by: string | null;
}

// Device presets for responsive design
export interface DevicePreset {
  name: 'mobile' | 'tablet' | 'desktop';
  width: number;
  height: number;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
];

// Default layouts for each room type
export const DEFAULT_VOICE_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [
    {
      id: 'room-header',
      type: 'room-header',
      x: 0,
      y: 0,
      width: 390,
      height: 80,
      zIndex: 10,
      visible: true,
      locked: false,
    },
    {
      id: 'ranking-bar',
      type: 'room-announcement',
      x: 0,
      y: 80,
      width: 390,
      height: 40,
      zIndex: 9,
      visible: true,
      locked: false,
    },
  ],
};

export const DEFAULT_VIDEO_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [],
};

export const DEFAULT_PK_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [],
};
