-- Repair Money Gun Jalwa media metadata so UI treats `icon` as emoji text
-- and uses `image_url` / `icon_path` as the real transparent thumbnail.

UPDATE public.gifts
   SET emoji = '💸',
       icon = '💸',
       icon_path = '/__l5e/assets-v1/5b2a04c7-e640-4818-9249-52d40d33bf71/money-gun-jalwa.png',
       image_url = '/__l5e/assets-v1/5b2a04c7-e640-4818-9249-52d40d33bf71/money-gun-jalwa.png',
       clip_path = '/__l5e/assets-v1/b226488c-c729-4b13-8418-ad2d1222f3b0/money-gun-jalwa.webm',
       clip_type = 'webm',
       animation = 'fullscreen',
       is_active = true,
       active = true,
       is_milestone = true
 WHERE lower(name) = 'money gun jalwa';

NOTIFY pgrst, 'reload schema';