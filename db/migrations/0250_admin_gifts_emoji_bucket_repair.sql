-- 0250_admin_gifts_emoji_bucket_repair.sql
-- Fix admin/app gift visibility mismatch and emoji upload bucket errors.
-- 1) Admin gifts now uses all categories, but the DB must also contain the
--    recently generated video gift packs in the live database.
-- 2) Emoji uploads use the existing public shop-assets bucket under
--    emoji-assets/*, so ensure admin storage write policies and emoji grants.

BEGIN;

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS icon_path text,
  ADD COLUMN IF NOT EXISTS clip_path text,
  ADD COLUMN IF NOT EXISTS clip_type text NOT NULL DEFAULT 'mp4',
  ADD COLUMN IF NOT EXISTS chromakey text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS batch_name text,
  ADD COLUMN IF NOT EXISTS batch_created_at timestamptz;

ALTER TABLE public.gifts DROP CONSTRAINT IF EXISTS gifts_chromakey_check;
ALTER TABLE public.gifts
  ADD CONSTRAINT gifts_chromakey_check
  CHECK (chromakey IN ('auto','none','screen','luma','green'));

GRANT SELECT ON public.gifts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;

CREATE OR REPLACE FUNCTION public._sync_gifts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.emoji IS NULL AND NEW.icon IS NOT NULL AND length(NEW.icon) <= 8 THEN NEW.emoji := NEW.icon; END IF;
  IF NEW.emoji IS NULL THEN NEW.emoji := '🎁'; END IF;
  IF NEW.icon IS NULL THEN NEW.icon := NEW.emoji; END IF;
  IF NEW.price IS NULL AND NEW.price_coins IS NOT NULL THEN NEW.price := NEW.price_coins; END IF;
  IF NEW.price_coins IS NULL AND NEW.price IS NOT NULL THEN NEW.price_coins := NEW.price; END IF;
  IF NEW.price IS NULL THEN NEW.price := 0; END IF;
  IF NEW.price_coins IS NULL THEN NEW.price_coins := NEW.price; END IF;
  IF NEW.is_active IS NULL AND NEW.active IS NOT NULL THEN NEW.is_active := NEW.active; END IF;
  IF NEW.active IS NULL AND NEW.is_active IS NOT NULL THEN NEW.active := NEW.is_active; END IF;
  IF NEW.is_active IS NULL THEN NEW.is_active := true; END IF;
  IF NEW.active IS NULL THEN NEW.active := NEW.is_active; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gifts_sync ON public.gifts;
CREATE TRIGGER trg_gifts_sync
  BEFORE INSERT OR UPDATE ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public._sync_gifts();

-- 30 luxury/VIP gifts with PNG thumbnails + MP4 playback.
INSERT INTO public.gifts
  (name, emoji, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, chromakey, sort_order, is_active, active, batch_name, batch_created_at)
VALUES
  ('Jalwa Diamond Waterfall','💎','vip',5000,5000,5000,'💎','/__l5e/assets-v1/659b3193-f62a-4a24-9657-73a4928bed26/thumb_diamond_waterfall.png','/__l5e/assets-v1/659b3193-f62a-4a24-9657-73a4928bed26/thumb_diamond_waterfall.png','/__l5e/assets-v1/057a8286-f9b2-4114-bddd-f3c4684da98b/gk3-diamond-waterfall.mp4','mp4','fullscreen','green',6001,true,true,'admin-repair-0250',now()),
  ('Jalwa Golden Peacock','🦚','vip',8000,8000,8000,'🦚','/__l5e/assets-v1/3edede2c-a5a0-48b3-9b90-355a25c5abe4/thumb_golden_peacock.png','/__l5e/assets-v1/3edede2c-a5a0-48b3-9b90-355a25c5abe4/thumb_golden_peacock.png','/__l5e/assets-v1/477b7873-239d-4418-8d6c-0cd5de79f855/gk3-golden-peacock.mp4','mp4','fullscreen','green',6002,true,true,'admin-repair-0250',now()),
  ('Jalwa Royal Elephant','🐘','vip',12000,12000,12000,'🐘','/__l5e/assets-v1/2a8702e0-6235-4414-bf3e-ea92a807fd49/thumb_royal_elephant.png','/__l5e/assets-v1/2a8702e0-6235-4414-bf3e-ea92a807fd49/thumb_royal_elephant.png','/__l5e/assets-v1/e3b8efd4-e8da-4b3f-8139-1b1eaec724cb/gk3-royal-elephant.mp4','mp4','fullscreen','green',6003,true,true,'admin-repair-0250',now()),
  ('Jalwa Cherry Blossom','🌸','vip',15000,15000,15000,'🌸','/__l5e/assets-v1/3f966d3e-bef7-40a1-9367-7a4bc484e928/thumb_cherry_blossom_rain.png','/__l5e/assets-v1/3f966d3e-bef7-40a1-9367-7a4bc484e928/thumb_cherry_blossom_rain.png','/__l5e/assets-v1/e419c87b-efc9-4f28-bd73-5e17a74bbb4a/gk3-cherry-blossom.mp4','mp4','fullscreen','green',6004,true,true,'admin-repair-0250',now()),
  ('Jalwa Crystal Chandelier','💠','vip',35000,35000,35000,'💠','/__l5e/assets-v1/06634a2b-1056-454f-8885-dc891db090ae/thumb_crystal_chandelier.png','/__l5e/assets-v1/06634a2b-1056-454f-8885-dc891db090ae/thumb_crystal_chandelier.png','/__l5e/assets-v1/1622ca5b-4779-4f78-8bda-4d03a46fd7c3/gk3-crystal-chandelier.mp4','mp4','fullscreen','green',6005,true,true,'admin-repair-0250',now()),
  ('Jalwa Speed Racer','🏎️','vip',45000,45000,45000,'🏎️','/__l5e/assets-v1/a80f172e-1ea9-4e0c-ae4d-e7d345ecc37c/thumb_sports_car.png','/__l5e/assets-v1/a80f172e-1ea9-4e0c-ae4d-e7d345ecc37c/thumb_sports_car.png','/__l5e/assets-v1/af048941-71b9-46cf-8576-3daed337bf30/gk3-speed-racer.mp4','mp4','fullscreen','green',6006,true,true,'admin-repair-0250',now()),
  ('Jalwa Sapphire Fountain','💧','vip',6000,6000,6000,'💧','/__l5e/assets-v1/0bee01cd-5703-46a5-b4e2-2b47c86f629f/thumb_sapphire_fountain.png','/__l5e/assets-v1/0bee01cd-5703-46a5-b4e2-2b47c86f629f/thumb_sapphire_fountain.png','/__l5e/assets-v1/849a90ea-9e88-4a9d-be72-0c4347cf8484/gk3-sapphire-fountain.mp4','mp4','fullscreen','green',6007,true,true,'admin-repair-0250',now()),
  ('Jalwa Silver Unicorn','🦄','vip',9000,9000,9000,'🦄','/__l5e/assets-v1/0dce3a65-4dd2-4f9e-9068-c75e5117af29/thumb_silver_unicorn.png','/__l5e/assets-v1/0dce3a65-4dd2-4f9e-9068-c75e5117af29/thumb_silver_unicorn.png','/__l5e/assets-v1/5591f5bc-bf62-4d0d-ab06-4a386bfc4d22/gk3-silver-unicorn.mp4','mp4','fullscreen','green',6008,true,true,'admin-repair-0250',now()),
  ('Jalwa Royal Tiger','🐅','vip',14000,14000,14000,'🐅','/__l5e/assets-v1/a69d1d42-be4f-46cc-a46c-edb500b54974/thumb_royal_tiger.png','/__l5e/assets-v1/a69d1d42-be4f-46cc-a46c-edb500b54974/thumb_royal_tiger.png','/__l5e/assets-v1/5e91cf6f-1017-4f9e-b153-21b930641304/gk3-royal-tiger.mp4','mp4','fullscreen','green',6009,true,true,'admin-repair-0250',now()),
  ('Jalwa Enchanted Garden','🌿','vip',18000,18000,18000,'🌿','/__l5e/assets-v1/e594f4fc-0b30-4530-98c7-2dfd49418562/thumb_enchanted_garden.png','/__l5e/assets-v1/e594f4fc-0b30-4530-98c7-2dfd49418562/thumb_enchanted_garden.png','/__l5e/assets-v1/27476adc-fcfe-40e5-8028-b0dce5f8df34/gk3-enchanted-garden.mp4','mp4','fullscreen','green',6010,true,true,'admin-repair-0250',now()),
  ('Jalwa Ice Dragon','🐲','vip',28000,28000,28000,'🐲','/__l5e/assets-v1/5134c927-9bfa-4755-bb48-2baa5e34a6b0/thumb_ice_dragon.png','/__l5e/assets-v1/5134c927-9bfa-4755-bb48-2baa5e34a6b0/thumb_ice_dragon.png','/__l5e/assets-v1/a0b47e3e-1c75-47bc-8c15-894ebb6c2ddf/gk3-ice-dragon.mp4','mp4','fullscreen','green',6011,true,true,'admin-repair-0250',now()),
  ('Jalwa Crystal Piano','🎹','vip',38000,38000,38000,'🎹','/__l5e/assets-v1/73226db9-289e-44bb-b89b-543fe34396cc/thumb_crystal_piano.png','/__l5e/assets-v1/73226db9-289e-44bb-b89b-543fe34396cc/thumb_crystal_piano.png','/__l5e/assets-v1/b8ec4bc7-bdeb-49b6-a07d-477842d1d07c/gk3-crystal-piano.mp4','mp4','fullscreen','green',6012,true,true,'admin-repair-0250',now()),
  ('Jalwa Lamborghini Storm','🏎️','vip',48000,48000,48000,'🏎️','/__l5e/assets-v1/286cb957-6152-4436-a3e3-12a845cb754a/thumb_lamborghini.png','/__l5e/assets-v1/286cb957-6152-4436-a3e3-12a845cb754a/thumb_lamborghini.png','/__l5e/assets-v1/393a7797-4ac3-496e-9d8d-b27ba06a198e/gk3-bugatti.mp4','mp4','fullscreen','green',6013,true,true,'admin-repair-0250',now()),
  ('Jalwa Emerald Necklace','📿','vip',85000,85000,85000,'📿','/__l5e/assets-v1/60f1a9ba-611e-418e-829b-ca711b1b9b4d/thumb_emerald_necklace.png','/__l5e/assets-v1/60f1a9ba-611e-418e-829b-ca711b1b9b4d/thumb_emerald_necklace.png','/__l5e/assets-v1/3ceaa309-b124-4276-8a24-55f1d814fae0/gk3-emerald-necklace.mp4','mp4','fullscreen','green',6014,true,true,'admin-repair-0250',now()),
  ('Jalwa Celestial Palace','🏯','vip',100000,100000,100000,'🏯','/__l5e/assets-v1/3353790c-6126-4c63-84ac-17ac3c073e14/thumb_celestial_palace.png','/__l5e/assets-v1/3353790c-6126-4c63-84ac-17ac3c073e14/thumb_celestial_palace.png','/__l5e/assets-v1/a1e0ca81-4a6b-436b-9f73-1e25c50ee3b4/gk3-celestial-palace.mp4','mp4','fullscreen','green',6015,true,true,'admin-repair-0250',now()),
  ('Jalwa Ruby Heart','❤️','vip',7000,7000,7000,'❤️','/__l5e/assets-v1/fe250fb4-ebdd-402c-b197-1992ea6154b8/thumb_ruby_heart.png','/__l5e/assets-v1/fe250fb4-ebdd-402c-b197-1992ea6154b8/thumb_ruby_heart.png','/__l5e/assets-v1/52a080d5-c670-41d1-bfed-f47fff16d51b/gk3-ruby-heart.mp4','mp4','fullscreen','green',6016,true,true,'admin-repair-0250',now()),
  ('Jalwa Pegasus','🐎','vip',11000,11000,11000,'🐎','/__l5e/assets-v1/0a77e5b3-fc5c-4349-a7eb-0b227d6c0348/thumb_pegasus.png','/__l5e/assets-v1/0a77e5b3-fc5c-4349-a7eb-0b227d6c0348/thumb_pegasus.png','/__l5e/assets-v1/c11c549a-7c49-4c62-8910-cffdee9f568e/gk3-pegasus.mp4','mp4','fullscreen','green',6017,true,true,'admin-repair-0250',now()),
  ('Jalwa Lion Throne','🦁','vip',16000,16000,16000,'🦁','/__l5e/assets-v1/531afb80-42b3-456d-bcf5-0e814f80dff2/thumb_lion_throne.png','/__l5e/assets-v1/531afb80-42b3-456d-bcf5-0e814f80dff2/thumb_lion_throne.png','/__l5e/assets-v1/29e18f40-c651-49fd-a382-bb4c34b32321/gk3-lion-throne.mp4','mp4','fullscreen','green',6018,true,true,'admin-repair-0250',now()),
  ('Jalwa Moonlight Swan','🦢','vip',20000,20000,20000,'🦢','/__l5e/assets-v1/befcb808-e55c-4649-8de5-c24b894160c1/thumb_moonlight_swan.png','/__l5e/assets-v1/befcb808-e55c-4649-8de5-c24b894160c1/thumb_moonlight_swan.png','/__l5e/assets-v1/905a484d-b951-4b98-9960-b4c217abb182/gk3-moonlight-swan.mp4','mp4','fullscreen','green',6019,true,true,'admin-repair-0250',now()),
  ('Jalwa Phoenix Rebirth','🔥','vip',30000,30000,30000,'🔥','/__l5e/assets-v1/cca9cfa4-1334-4dcb-9780-02383d3150dd/thumb_phoenix_rebirth.png','/__l5e/assets-v1/cca9cfa4-1334-4dcb-9780-02383d3150dd/thumb_phoenix_rebirth.png','/__l5e/assets-v1/286992ac-5954-4f76-b034-881dd65bead1/gk3-phoenix-rebirth.mp4','mp4','fullscreen','green',6020,true,true,'admin-repair-0250',now()),
  ('Jalwa Diamond Butterflies','🦋','vip',40000,40000,40000,'🦋','/__l5e/assets-v1/f860602f-202e-4fcd-a771-c6dd61297b66/thumb_diamond_butterflies.png','/__l5e/assets-v1/f860602f-202e-4fcd-a771-c6dd61297b66/thumb_diamond_butterflies.png','/__l5e/assets-v1/fe2f6cb5-d17e-4418-b48c-c648866ecc51/gk3-diamond-butterflies.mp4','mp4','fullscreen','green',6021,true,true,'admin-repair-0250',now()),
  ('Jalwa Bugatti Chiron','🏎️','vip',50000,50000,50000,'🏎️','/__l5e/assets-v1/20fe0c89-1fe4-4d75-93fd-ae5fd03ee79b/thumb_bugatti.png','/__l5e/assets-v1/20fe0c89-1fe4-4d75-93fd-ae5fd03ee79b/thumb_bugatti.png','/__l5e/assets-v1/393a7797-4ac3-496e-9d8d-b27ba06a198e/gk3-bugatti.mp4','mp4','fullscreen','green',6022,true,true,'admin-repair-0250',now()),
  ('Jalwa Private Island','🏝️','vip',70000,70000,70000,'🏝️','/__l5e/assets-v1/ea8898f7-069c-48d2-85a7-48aa525827d3/thumb_private_island.png','/__l5e/assets-v1/ea8898f7-069c-48d2-85a7-48aa525827d3/thumb_private_island.png','/__l5e/assets-v1/60a75c31-2bc1-4e8f-9196-3f3c6a409186/gk3-private-island.mp4','mp4','fullscreen','green',6023,true,true,'admin-repair-0250',now()),
  ('Jalwa Crown Jewels','👑','vip',90000,90000,90000,'👑','/__l5e/assets-v1/2b1408d7-13b2-4151-af55-c8b9793c4901/thumb_crown_jewels.png','/__l5e/assets-v1/2b1408d7-13b2-4151-af55-c8b9793c4901/thumb_crown_jewels.png','/__l5e/assets-v1/4dea4ccf-e5fd-4e55-bb0a-95a3631d9dca/gk3-crown-jewels.mp4','mp4','fullscreen','green',6024,true,true,'admin-repair-0250',now()),
  ('Jalwa Cosmic Wedding','💒','vip',100000,100000,100000,'💒','/__l5e/assets-v1/203fcc20-6152-4793-877d-124216f8fe4d/thumb_cosmic_wedding.png','/__l5e/assets-v1/203fcc20-6152-4793-877d-124216f8fe4d/thumb_cosmic_wedding.png','/__l5e/assets-v1/14d5d114-607f-4884-ae47-8e7c095b1306/gk3-cosmic-wedding.mp4','mp4','fullscreen','green',6025,true,true,'admin-repair-0250',now())
ON CONFLICT (name) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  icon = EXCLUDED.icon,
  image_url = EXCLUDED.image_url,
  icon_path = EXCLUDED.icon_path,
  clip_path = EXCLUDED.clip_path,
  clip_type = EXCLUDED.clip_type,
  animation = EXCLUDED.animation,
  chromakey = EXCLUDED.chromakey,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  active = true,
  batch_name = EXCLUDED.batch_name,
  batch_created_at = EXCLUDED.batch_created_at;

-- Green-screen mixed pack + romantic VIP video gifts. Grid icon stays emoji;
-- full MP4 plays only when sent.
INSERT INTO public.gifts
  (name, emoji, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, chromakey, sort_order, is_active, active, batch_name, batch_created_at)
VALUES
  ('Rose Heart','🌹','vip',5000,5000,5000,'🌹',NULL,NULL,'/__l5e/assets-v1/6ce3d670-02e7-4101-a721-468f03609db3/gk3-rose-heart.mp4','mp4','fullscreen','green',6101,true,true,'admin-repair-0250',now()),
  ('Couple Dance','💃','vip',15000,15000,15000,'💃',NULL,NULL,'/__l5e/assets-v1/244ff048-fd39-4c22-adec-855e8fe56fe6/gk3-couple-dance.mp4','mp4','fullscreen','green',6102,true,true,'admin-repair-0250',now()),
  ('Cupid Arrow','🏹','vip',8000,8000,8000,'🏹',NULL,NULL,'/__l5e/assets-v1/009cff1f-37c6-4535-9f81-1cae73da29e5/gk3-cupid-arrow.mp4','mp4','fullscreen','green',6103,true,true,'admin-repair-0250',now()),
  ('999 Roses','🌹','vip',20000,20000,20000,'🌹',NULL,NULL,'/__l5e/assets-v1/9f82897f-f1d0-4e83-b8c2-20c7d045162c/gk3-999-roses.mp4','mp4','fullscreen','green',6104,true,true,'admin-repair-0250',now()),
  ('Diamond Ring','💍','vip',30000,30000,30000,'💍',NULL,NULL,'/__l5e/assets-v1/9de64a48-cb33-4652-8dc6-968516e62d2e/gk3-diamond-ring-v2.mp4','mp4','fullscreen','green',6105,true,true,'admin-repair-0250',now()),
  ('Heart Fireworks','🎆','vip',10000,10000,10000,'🎆',NULL,NULL,'/__l5e/assets-v1/d40d283d-d20a-4e5b-a748-06787c4cb2dd/gk3-heart-fireworks.mp4','mp4','fullscreen','green',6106,true,true,'admin-repair-0250',now()),
  ('Teddy Balloons','🧸','vip',6000,6000,6000,'🧸',NULL,NULL,'/__l5e/assets-v1/79ded73f-cad1-48d7-9e2c-60c7836cfcbb/gk3-teddy-balloons.mp4','mp4','fullscreen','green',6107,true,true,'admin-repair-0250',now()),
  ('Love Letter','💌','vip',7000,7000,7000,'💌',NULL,NULL,'/__l5e/assets-v1/77f7f342-6d93-43b0-8cb2-d4e891cbff2c/gk3-love-letter.mp4','mp4','fullscreen','green',6108,true,true,'admin-repair-0250',now()),
  ('Swan Lake','🦢','vip',25000,25000,25000,'🦢',NULL,NULL,'/__l5e/assets-v1/3cbf7ad5-29dd-40ec-8ca5-cf6506ceef14/gk3-swan-lake.mp4','mp4','fullscreen','green',6109,true,true,'admin-repair-0250',now()),
  ('Champagne Hearts','🍾','vip',12000,12000,12000,'🍾',NULL,NULL,'/__l5e/assets-v1/c4ca9cc0-5537-484c-a739-29b0e99fbea9/gk3-champagne-hearts.mp4','mp4','fullscreen','green',6110,true,true,'admin-repair-0250',now()),
  ('Rooftop Kiss','💋','vip',8000,8000,8000,'💋',NULL,NULL,'/__l5e/assets-v1/4d9478cd-ef3d-4252-97a4-a24c1e342f3d/gk3-rooftop-kiss.mp4','mp4','fullscreen','green',6111,true,true,'admin-repair-0250',now()),
  ('Crystal Heart Burst','💖','vip',15000,15000,15000,'💖',NULL,NULL,'/__l5e/assets-v1/23d18d86-2b77-4e7f-a9a8-e0f139db53a6/gk3-crystal-heart-burst.mp4','mp4','fullscreen','green',6112,true,true,'admin-repair-0250',now()),
  ('Ballroom Waltz','💃','vip',20000,20000,20000,'💃',NULL,NULL,'/__l5e/assets-v1/421b7396-7d8c-475b-8736-0ba8be883197/gk3-ballroom-waltz.mp4','mp4','fullscreen','green',6113,true,true,'admin-repair-0250',now()),
  ('Proposal Fireworks','💍','vip',40000,40000,40000,'💍',NULL,NULL,'/__l5e/assets-v1/d3165b77-1b2c-4ea6-94d2-99b96252d676/gk3-proposal-fireworks.mp4','mp4','fullscreen','green',6114,true,true,'admin-repair-0250',now()),
  ('Golden Carriage','👑','vip',35000,35000,35000,'👑',NULL,NULL,'/__l5e/assets-v1/8234e9b8-0621-472d-a6ea-4afc2d95f84a/gk3-golden-carriage.mp4','mp4','fullscreen','green',6115,true,true,'admin-repair-0250',now()),
  ('Sunset Beach Love','🏖️','vip',10000,10000,10000,'🏖️',NULL,NULL,'/__l5e/assets-v1/b8d6eb0e-9270-46d1-9bf1-1e20ed62a5a9/gk3-sunset-beach.mp4','mp4','fullscreen','green',6116,true,true,'admin-repair-0250',now()),
  ('999 Roses Heart','🌹','vip',50000,50000,50000,'🌹',NULL,NULL,'/__l5e/assets-v1/2d1a0230-f427-44d9-9bfd-e2a55a376edd/gk3-999-roses-heart.mp4','mp4','fullscreen','green',6117,true,true,'admin-repair-0250',now()),
  ('Pegasus of Love','🐎','vip',45000,45000,45000,'🐎',NULL,NULL,'/__l5e/assets-v1/5657a44d-30f0-4ec4-9883-884207d3be32/gk3-pegasus-love.mp4','mp4','fullscreen','green',6118,true,true,'admin-repair-0250',now()),
  ('Swan Heart Lake','🦢','vip',25000,25000,25000,'🦢',NULL,NULL,'/__l5e/assets-v1/ea43792f-b838-43fa-a4df-cbb937a53dfa/gk3-swan-heart-lake.mp4','mp4','fullscreen','green',6119,true,true,'admin-repair-0250',now()),
  ('Teddy & Chocolate','🧸','vip',6000,6000,6000,'🧸',NULL,NULL,'/__l5e/assets-v1/2ad827d2-f718-475f-8b1b-a3dfb5ef1b85/gk3-teddy-chocolate.mp4','mp4','fullscreen','green',6120,true,true,'admin-repair-0250',now()),
  ('Jalwa Sports Car','🏎️','luxury',25000,25000,25000,'🏎️',NULL,NULL,'/__l5e/assets-v1/16f6010e-f1a7-421a-9e8c-9969ce6f48f3/gk2-01-sports-car.mp4','mp4','cinematic','green',6121,true,true,'admin-repair-0250',now()),
  ('Jalwa Private Jet','🛩️','luxury',40000,40000,40000,'🛩️',NULL,NULL,'/__l5e/assets-v1/52557a5f-9545-4254-865e-88afe15d55e8/gk3-private-jet.mp4','mp4','cinematic','green',6122,true,true,'admin-repair-0250',now()),
  ('Jalwa Mega Yacht','🛥️','luxury',50000,50000,50000,'🛥️',NULL,NULL,'/__l5e/assets-v1/5fe0c9ff-ea27-46e9-8b97-fae55520d8a0/gk2-03-mega-yacht.mp4','mp4','cinematic','green',6123,true,true,'admin-repair-0250',now()),
  ('Jalwa Mansion','🏰','luxury',35000,35000,35000,'🏰',NULL,NULL,'/__l5e/assets-v1/210e2747-eecc-4ab4-a05a-4bf488ada842/gk2-04-mansion.mp4','mp4','cinematic','green',6124,true,true,'admin-repair-0250',now()),
  ('Jalwa Gold Rolex','⌚','luxury',15000,15000,15000,'⌚',NULL,NULL,'/__l5e/assets-v1/9fe563be-6927-47ef-adbe-46db29582a9c/gk2-05-gold-rolex.mp4','mp4','cinematic','green',6125,true,true,'admin-repair-0250',now()),
  ('Jalwa Rose Bouquet','💐','romantic',5000,5000,5000,'💐',NULL,NULL,'/__l5e/assets-v1/050e7184-24b8-491e-bcab-a7b1b956e185/gk2-06-rose-bouquet.mp4','mp4','cinematic','green',6126,true,true,'admin-repair-0250',now()),
  ('Jalwa Couple Kiss','💋','romantic',8000,8000,8000,'💋',NULL,NULL,'/__l5e/assets-v1/c34931e8-1549-48cb-913b-fc2a4a65fc7c/gk2-08-couple-kiss.mp4','mp4','cinematic','green',6127,true,true,'admin-repair-0250',now()),
  ('Jalwa Love Letter','💌','romantic',6000,6000,6000,'💌',NULL,NULL,'/__l5e/assets-v1/ae494799-b98d-4fee-a204-889f22be36ef/gk2-09-love-letter.mp4','mp4','cinematic','green',6128,true,true,'admin-repair-0250',now()),
  ('Jalwa Swan Pair','🦢','romantic',10000,10000,10000,'🦢',NULL,NULL,'/__l5e/assets-v1/147b4cb7-9f99-4162-86c7-e9e832168517/gk2-10-swan-pair.mp4','mp4','cinematic','green',6129,true,true,'admin-repair-0250',now()),
  ('Jalwa Fireworks','🎆','party',7000,7000,7000,'🎆',NULL,NULL,'/__l5e/assets-v1/9bc498ee-e2f1-443d-9add-c44ff3776199/gk2-11-fireworks.mp4','mp4','cinematic','green',6130,true,true,'admin-repair-0250',now()),
  ('Jalwa Birthday Cake','🎂','party',5000,5000,5000,'🎂',NULL,NULL,'/__l5e/assets-v1/20002f0d-2c5a-4d36-8067-7135315d366b/gk2-12-birthday-cake.mp4','mp4','cinematic','green',6131,true,true,'admin-repair-0250',now()),
  ('Jalwa Champagne Pop','🍾','party',12000,12000,12000,'🍾',NULL,NULL,'/__l5e/assets-v1/693f638c-6de0-4853-9154-956646fa3b90/gk2-13-champagne-pop.mp4','mp4','cinematic','green',6132,true,true,'admin-repair-0250',now()),
  ('Jalwa Confetti Burst','🎉','party',5000,5000,5000,'🎉',NULL,NULL,'/__l5e/assets-v1/8b233b93-7633-437e-935b-ec516c2ecd46/gk2-14-confetti-burst.mp4','mp4','cinematic','green',6133,true,true,'admin-repair-0250',now()),
  ('Jalwa Disco Ball','🪩','party',8000,8000,8000,'🪩',NULL,NULL,'/__l5e/assets-v1/fcd218b9-292e-426a-83a9-8216773c6ca3/gk2-15-disco-ball.mp4','mp4','cinematic','green',6134,true,true,'admin-repair-0250',now()),
  ('Jalwa Rainbow Unicorn','🦄','fantasy',20000,20000,20000,'🦄',NULL,NULL,'/__l5e/assets-v1/3574fc55-bcdf-4e0f-a6a8-aec3f022555d/gk2-18-unicorn.mp4','mp4','cinematic','green',6135,true,true,'admin-repair-0250',now()),
  ('Jalwa Mermaid','🧜','fantasy',18000,18000,18000,'🧜',NULL,NULL,'/__l5e/assets-v1/2373b1fe-dcf8-4ef7-8411-e2092c492754/gk2-19-mermaid.mp4','mp4','cinematic','green',6136,true,true,'admin-repair-0250',now()),
  ('Jalwa Wizard Spell','🧙','fantasy',22000,22000,22000,'🧙',NULL,NULL,'/__l5e/assets-v1/814dea4c-780b-4773-bcfc-8f0f6ceb9beb/gk2-20-wizard.mp4','mp4','cinematic','green',6137,true,true,'admin-repair-0250',now())
ON CONFLICT (name) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  icon = EXCLUDED.icon,
  image_url = EXCLUDED.image_url,
  icon_path = EXCLUDED.icon_path,
  clip_path = EXCLUDED.clip_path,
  clip_type = EXCLUDED.clip_type,
  animation = EXCLUDED.animation,
  chromakey = EXCLUDED.chromakey,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  active = true,
  batch_name = EXCLUDED.batch_name,
  batch_created_at = EXCLUDED.batch_created_at;

UPDATE public.gifts
   SET chromakey = 'green', active = true, is_active = true
 WHERE clip_type IN ('mp4','webm')
    OR clip_path ~* '\.(mp4|webm)(\?|$)';

-- Emoji admin write + strict two-tier data cleanup.
ALTER TABLE public.chat_emojis
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS min_vip_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_animated boolean NOT NULL DEFAULT false;

UPDATE public.chat_emojis
   SET tier = CASE WHEN tier = 'vip' THEN 'vip' ELSE 'normal' END,
       min_vip_level = CASE WHEN tier = 'vip' THEN GREATEST(min_vip_level, 1) ELSE 0 END;

ALTER TABLE public.chat_emojis DROP CONSTRAINT IF EXISTS chat_emojis_tier_check;
ALTER TABLE public.chat_emojis
  ADD CONSTRAINT chat_emojis_tier_check CHECK (tier IN ('normal','vip'));

GRANT SELECT ON public.chat_emojis TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_emojis TO authenticated;
GRANT ALL ON public.chat_emojis TO service_role;

ALTER TABLE public.chat_emojis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_emojis read" ON public.chat_emojis;
CREATE POLICY "chat_emojis read" ON public.chat_emojis
  FOR SELECT TO anon, authenticated USING (is_active);
DROP POLICY IF EXISTS "chat_emojis admin insert" ON public.chat_emojis;
CREATE POLICY "chat_emojis admin insert" ON public.chat_emojis
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "chat_emojis admin update" ON public.chat_emojis;
CREATE POLICY "chat_emojis admin update" ON public.chat_emojis
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "chat_emojis admin delete" ON public.chat_emojis;
CREATE POLICY "chat_emojis admin delete" ON public.chat_emojis
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Existing public bucket used by gift uploads; emoji admin uploads now share it
-- under the emoji-assets/ prefix to avoid missing public-assets bucket errors.
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "shop assets public read" ON storage.objects;
CREATE POLICY "shop assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-assets');
DROP POLICY IF EXISTS "admins upload shop assets" ON storage.objects;
CREATE POLICY "admins upload shop assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-assets' AND public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins update shop assets" ON storage.objects;
CREATE POLICY "admins update shop assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'shop-assets' AND public.is_admin(auth.uid())) WITH CHECK (bucket_id = 'shop-assets' AND public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins delete shop assets" ON storage.objects;
CREATE POLICY "admins delete shop assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'shop-assets' AND public.is_admin(auth.uid()));

INSERT INTO public._migrations (name)
SELECT '0250_admin_gifts_emoji_bucket_repair.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_migrations'
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;