-- User request: gifting per notification nahi ani chahiye.
-- Drop the gift_received notification trigger + function.

drop trigger if exists trg_gift_sends_notify on public.gift_sends;
drop function if exists public.trg_gift_send_notify();
