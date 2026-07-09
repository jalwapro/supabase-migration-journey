-- Add 'emoji' variant to message_kind so seat-reaction broadcasts persist
-- and realtime can fan them out to every viewer.
alter type public.message_kind add value if not exists 'emoji';
