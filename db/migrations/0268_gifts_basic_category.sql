-- Merge the non-premium gift buckets into a single "basic" category.
UPDATE public.gifts
SET category = 'basic'
WHERE category IN ('classic', 'love', 'popular');
