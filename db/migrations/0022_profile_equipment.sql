-- 0022_profile_equipment.sql
-- Add columns on profiles for each shop category so equipped items render
-- across the app in their proper placement.
--
-- Placements decided by design:
--   frame       -> avatar overlay (already exists)
--   ring        -> rotating aura ring behind avatar
--   bubble      -> chat message bubble background (DM / room chat)
--   car         -> profile hero decorative animation
--   entrance    -> full-width entrance banner at top of profile
--   special_id  -> decorative chip shown next to user ID
--   data_card   -> background image of the profile hero card

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ring        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bubble      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS car         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entrance    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS special_id  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_card   text;

-- profiles already has grants + RLS from 0001; nothing else needed.
