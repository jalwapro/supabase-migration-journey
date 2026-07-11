-- Hard-delete all gifts and their send history (fresh start requested by user).
DELETE FROM public.gift_sends;
DELETE FROM public.gifts;
