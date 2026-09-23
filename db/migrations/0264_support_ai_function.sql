-- 0264 — Route support chat through server-side JALWA AI
-- The previous keyword trigger is replaced by the authenticated support-ai Edge Function.

drop trigger if exists trg_support_auto_reply on public.support_messages;
notify pgrst, 'reload schema';
