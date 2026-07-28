export type ProfileCardRarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type ProfileCardFrame = "gold" | "neon" | "diamond" | "aurora" | "none";
export type ProfileCardParticle = "none" | "sparkles" | "embers" | "petals" | "snow" | "stars" | "bubbles";
export type ProfileCardMediaType = "builtin" | "image" | "mp4" | "webm" | "lottie" | "svga";
export type ProfileCardChroma = "none" | "green" | "black" | "luma";

export type ProfileCard = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  rarity: ProfileCardRarity;
  bg_media_url: string;
  bg_media_type: ProfileCardMediaType;
  bg_chromakey: ProfileCardChroma;
  thumbnail_url: string | null;
  frame_effect: ProfileCardFrame;
  accent_color: string;
  glow_color: string;
  particle_style: ProfileCardParticle;
  price_coins: number;
  price_diamonds: number;
  min_vip_level: number;
  duration_days: number | null;
  is_active: boolean;
  is_limited: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export const PROFILE_CARD_CATEGORIES = [
  "Basic",
  "VIP",
  "Royal",
  "Luxury",
  "Fantasy",
  "Galaxy",
  "Nature",
  "Neon",
  "Event",
];

export const RARITY_STYLE: Record<ProfileCardRarity, { label: string; className: string }> = {
  common:    { label: "Common",    className: "bg-slate-500/20 text-slate-200 border-slate-400/40" },
  rare:      { label: "Rare",      className: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
  epic:      { label: "Epic",      className: "bg-violet-500/20 text-violet-200 border-violet-400/50" },
  legendary: { label: "Legendary", className: "bg-amber-500/25 text-amber-100 border-amber-400/60" },
  mythic:    { label: "Mythic",    className: "bg-fuchsia-500/25 text-fuchsia-100 border-fuchsia-400/60" },
};
