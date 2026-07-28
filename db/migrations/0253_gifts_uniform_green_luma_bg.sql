-- Uniform green background across ALL gifts.
-- Some clips ship with green source bg, others with black/dark. Using `green`
-- chromakey alone only helped the first group; `luma` mode now also renders
-- the green stage AND strips dark backgrounds via the luma-key SVG filter,
-- so every gift ends up as a clean subject over a uniform green backdrop.
UPDATE public.gifts
   SET chromakey = 'green'
 WHERE chromakey IS DISTINCT FROM 'green';

NOTIFY pgrst, 'reload schema';
