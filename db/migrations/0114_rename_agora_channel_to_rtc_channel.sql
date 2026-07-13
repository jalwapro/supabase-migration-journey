-- Rename live_rooms.agora_channel to live_rooms.rtc_channel
-- (Agora → ZEGOCLOUD migration; column is RTC-provider-agnostic now.)

ALTER TABLE public.live_rooms
  RENAME COLUMN agora_channel TO rtc_channel;

ALTER TABLE public.live_rooms
  RENAME CONSTRAINT live_rooms_agora_channel_key TO live_rooms_rtc_channel_key;
