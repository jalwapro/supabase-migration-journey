-- Puppy Love price bumped to 1000 coins.
UPDATE public.gifts
SET price = 1000, price_coins = 1000, diamonds_value = 1000
WHERE lower(name) = 'jalwa puppy love';
