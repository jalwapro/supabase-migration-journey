export type RoomType = "voice" | "video" | "pk";

export interface RoomParticipant {
  id: string;
  username: string;
  avatar: string | null;
  level: number;
  is_vip: boolean;
  vip_level?: number | null;
  is_muted: boolean;
  is_speaking: boolean;
  has_video: boolean;
  gift_score: number;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
}

export interface RoomSeat {
  index: number;
  user: RoomParticipant | null;
  is_locked: boolean;
  is_requested: boolean;
}

export interface PKState {
  match_id: string;
  status: "idle" | "countdown" | "active" | "finished";
  player_a: RoomParticipant;
  player_b: RoomParticipant;
  score_a: number;
  score_b: number;
  ends_at: string | null;
  winner_id: string | null;
}

export interface RoomState {
  id: string;
  title: string;
  type: RoomType;
  host: RoomParticipant;
  viewer_count: number;
  seats: RoomSeat[];
  pk: PKState | null;
}
