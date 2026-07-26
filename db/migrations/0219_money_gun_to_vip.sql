-- Move Jalwa Money Gun to VIP category and set price to 500 coins.
UPDATE public.gifts
   SET category = 'vip',
       price = 500,
       price_coins = 500
 WHERE lower(name) = 'jalwa money gun';
