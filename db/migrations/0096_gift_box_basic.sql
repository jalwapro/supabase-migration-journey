-- Basic animated gift box
BEGIN;
INSERT INTO public.gifts (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
VALUES ('Gift Box', '🎁', '🎁', 100, 100, 50, 'popular', 'pop', 5,
  '/animations/gifts/jalwa-gift-box.svg', 'svg', true, true)
ON CONFLICT DO NOTHING;

UPDATE public.gifts
SET clip_path='/animations/gifts/jalwa-gift-box.svg', clip_type='svg', is_active=true, active=true
WHERE name='Gift Box';
COMMIT;
