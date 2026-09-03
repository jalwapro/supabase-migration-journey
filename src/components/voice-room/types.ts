// Shared presentation types for the Voice Room editor components.
// Runtime room data comes from the production /room/$roomId route and Supabase.

export type MicState = "on" | "off" | "muted" | "speaking";
export interface SeatUser { id: string; name: string; avatarUrl: string; popularity: number; mic: MicState; online: boolean; }
export interface RoomSeat { seatNumber: number; user: SeatUser | null; }
export interface HostInfo { id: string; name: string; avatarUrl: string; popularity: number; mic: MicState; verified: boolean; }
export type AnnouncementKind = "gift" | "enter" | "leave" | "host" | "achievement" | "system";
export interface AnnouncementItem { id: string; kind: AnnouncementKind; text: string; }
export type ChatMessageKind = "user" | "system" | "gift" | "announcement" | "chat";
export interface ChatMessage { id: string; kind: ChatMessageKind; userName?: string; userColor?: string; body: string; giftName?: string; giftIcon?: string; }
export interface EventBanner { id: string; title: string; imageUrl: string; badge?: string; }
export function formatCount(n: number): string { if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`; return `${n}`; }
