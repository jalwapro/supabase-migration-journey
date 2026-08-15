// Voice Room — shared types & mock data.
// This mirrors the shape of real room/seat/message data so it's a drop-in
// swap once wired to Supabase (see room.$roomId.tsx for the live equivalent).

export type MicState = "on" | "off" | "muted" | "speaking";

export interface SeatUser {
  id: string;
  name: string;
  avatarUrl: string;
  popularity: number;
  mic: MicState;
  online: boolean;
}

export interface RoomSeat {
  seatNumber: number;
  user: SeatUser | null;
}

export interface HostInfo {
  id: string;
  name: string;
  avatarUrl: string;
  popularity: number;
  mic: MicState;
  verified: boolean;
}

export type AnnouncementKind = "gift" | "enter" | "leave" | "host" | "achievement" | "system";

export interface AnnouncementItem {
  id: string;
  kind: AnnouncementKind;
  text: string;
}

export type ChatMessageKind = "user" | "system" | "gift" | "announcement";

export interface ChatMessage {
  id: string;
  kind: ChatMessageKind;
  userName?: string;
  userColor?: string;
  body: string;
  giftName?: string;
  giftIcon?: string;
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  category: "popular" | "romantic" | "luxury" | "fun";
}

export const MOCK_HOST: HostInfo = {
  id: "host-1",
  name: "ALI KING",
  avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=AliKing&backgroundColor=b6e3f4",
  popularity: 12500,
  mic: "speaking",
  verified: true,
};

const NAMES = [
  "Sana", "Zara", "Bilal", "Hina", "Usman", "Ayesha", "Hamza", "Mahnoor",
  "Fahad", "Iqra", "Talha", "Areeba", "Danish", "Sarah", "Kamran", "Noor",
];

function seededAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}

const MIC_CYCLE: MicState[] = ["on", "off", "muted", "speaking"];

export function buildMockSeats(): RoomSeat[] {
  const occupiedSeatNumbers = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 15, 16, 18, 19]);
  const seats: RoomSeat[] = [];
  let nameIdx = 0;
  for (let i = 1; i <= 20; i++) {
    if (occupiedSeatNumbers.has(i)) {
      const name = NAMES[nameIdx % NAMES.length];
      nameIdx++;
      seats.push({
        seatNumber: i,
        user: {
          id: `user-${i}`,
          name,
          avatarUrl: seededAvatar(name + i),
          popularity: Math.floor(Math.random() * 900) + 10,
          mic: MIC_CYCLE[i % MIC_CYCLE.length],
          online: true,
        },
      });
    } else {
      seats.push({ seatNumber: i, user: null });
    }
  }
  return seats;
}

export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  { id: "a1", kind: "gift", text: "User Ali has sent Rose x10" },
  { id: "a2", kind: "enter", text: "User Sana entered the room" },
  { id: "a3", kind: "host", text: "User King is now Host" },
  { id: "a4", kind: "achievement", text: "Room reached Level 12 popularity" },
];

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", kind: "system", body: "Welcome to Love Is Life 💖" },
  { id: "m2", kind: "user", userName: "Sana", userColor: "text-pink-400", body: "hiii everyone 👋" },
  { id: "m3", kind: "user", userName: "Bilal", userColor: "text-violet-400", body: "great vibes tonight 🔥" },
  { id: "m4", kind: "gift", userName: "Zara", body: "sent a gift", giftName: "Rose", giftIcon: "🌹" },
  { id: "m5", kind: "announcement", body: "User King is now Host 👑" },
];

export const MOCK_GIFTS: GiftItem[] = [
  { id: "g1", name: "Rose", icon: "🌹", price: 10, category: "popular" },
  { id: "g2", name: "Heart", icon: "💖", price: 20, category: "romantic" },
  { id: "g3", name: "Ring", icon: "💍", price: 500, category: "romantic" },
  { id: "g4", name: "Crown", icon: "👑", price: 1000, category: "luxury" },
  { id: "g5", name: "Sports Car", icon: "🏎️", price: 5000, category: "luxury" },
  { id: "g6", name: "Fireworks", icon: "🎆", price: 300, category: "fun" },
  { id: "g7", name: "Rocket", icon: "🚀", price: 2000, category: "luxury" },
  { id: "g8", name: "Balloon", icon: "🎈", price: 50, category: "fun" },
  { id: "g9", name: "Diamond", icon: "💎", price: 3000, category: "luxury" },
  { id: "g10", name: "Kiss", icon: "💋", price: 15, category: "romantic" },
  { id: "g11", name: "Candy", icon: "🍬", price: 5, category: "popular" },
  { id: "g12", name: "Cake", icon: "🎂", price: 200, category: "popular" },
];

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
