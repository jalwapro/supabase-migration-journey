-- Enable realtime delivery for the CP marquee. No LiveKit changes.
begin;
alter publication supabase_realtime add table public.cp_broadcasts;
commit;
