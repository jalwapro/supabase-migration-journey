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
function createSeatElements(count: number, canvasWidth = 390): LayoutElement[] {
  const cols = count <= 4 ? 2 : count <= 8 ? 4 : 5;
  const seatWidth = count <= 4 ? 150 : 70;
  const seatHeight = count <= 4 ? 150 : 78;
  const gapX = count <= 4 ? 18 : 8;
  const gapY = count <= 4 ? 18 : 10;
  const totalWidth = cols * seatWidth + (cols - 1) * gapX;
  const startX = Math.max(0, (canvasWidth - totalWidth) / 2);
  const startY = 145;

  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: `seat-${index + 1}`,
      type: 'seat',
      x: startX + col * (seatWidth + gapX),
      y: startY + row * (seatHeight + gapY),
      width: seatWidth,
      height: seatHeight,
      zIndex: 20,
      visible: true,
      locked: false,
      borderRadius: 18,
      style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' },
      data: { seatNumber: index + 1 },
    };
  });
}

export const DEFAULT_VOICE_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [
    {
      id: 'room-header', type: 'room-header', x: 0, y: 0, width: 390, height: 80,
      zIndex: 10, visible: true, locked: true,
    },
    {
      id: 'ranking-bar', type: 'room-announcement', x: 0, y: 80, width: 390, height: 40,
      zIndex: 9, visible: true, locked: true,
    },
    ...createSeatElements(20),
    {
      id: 'chat-panel', type: 'chat-panel', x: 10, y: 650, width: 370, height: 110,
      zIndex: 40, visible: true, locked: false,
    },
  ],
};

export const DEFAULT_VIDEO_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [
    { id: 'room-header', type: 'room-header', x: 0, y: 0, width: 390, height: 80, zIndex: 10, visible: true, locked: true },
    { id: 'video-1', type: 'video-participant', x: 10, y: 100, width: 180, height: 300, zIndex: 20, visible: true, locked: false },
    { id: 'video-2', type: 'video-participant', x: 200, y: 100, width: 180, height: 300, zIndex: 20, visible: true, locked: false },
    { id: 'video-3', type: 'video-participant', x: 10, y: 410, width: 180, height: 220, zIndex: 20, visible: true, locked: false },
    { id: 'video-4', type: 'video-participant', x: 200, y: 410, width: 180, height: 220, zIndex: 20, visible: true, locked: false },
    { id: 'chat-panel', type: 'chat-panel', x: 10, y: 650, width: 370, height: 110, zIndex: 40, visible: true, locked: false },
  ],
};

export const DEFAULT_PK_LAYOUT: LayoutJSON = {
  version: 1,
  canvas: { width: 390, height: 844 },
  background: { type: 'color', value: '#0a0a0f' },
  elements: [
    { id: 'room-header', type: 'room-header', x: 0, y: 0, width: 390, height: 70, zIndex: 10, visible: true, locked: true },
    { id: 'pk-player-a', type: 'pk-player', x: 10, y: 100, width: 170, height: 260, zIndex: 20, visible: true, locked: false, data: { side: 'a' } },
    { id: 'pk-player-b', type: 'pk-player', x: 210, y: 100, width: 170, height: 260, zIndex: 20, visible: true, locked: false, data: { side: 'b' } },
    { id: 'pk-vs', type: 'pk-vs-logo', x: 165, y: 190, width: 60, height: 60, zIndex: 30, visible: true, locked: false },
    { id: 'pk-score', type: 'pk-score-bar', x: 20, y: 380, width: 350, height: 55, zIndex: 25, visible: true, locked: false },
    { id: 'pk-progress', type: 'pk-progress-bar', x: 20, y: 450, width: 350, height: 18, zIndex: 25, visible: true, locked: false },
    { id: 'pk-timer', type: 'pk-timer', x: 145, y: 490, width: 100, height: 50, zIndex: 30, visible: true, locked: false },
    { id: 'chat-panel', type: 'chat-panel', x: 10, y: 650, width: 370, height: 110, zIndex: 40, visible: true, locked: false },
  ],
};
