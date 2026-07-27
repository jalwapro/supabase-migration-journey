-- Set ALL gifts to green chromakey so admin can control removal uniformly.
-- Backgrounds render green in the player; admin's green-key filter strips them.
UPDATE public.gifts
   SET chromakey = 'green'
 WHERE chromakey IS DISTINCT FROM 'green';

NOTIFY pgrst, 'reload schema';
