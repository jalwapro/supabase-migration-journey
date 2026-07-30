-- 0270: 50 new green-screen video gifts + refreshed room rank frames.
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   clip_path, clip_type, image_url, sort_order, is_active, active, chromakey)
VALUES
  ('Ferrari Storm','🏎️','🏎️',9999,9999,9999,'luxury','pop','/__l5e/assets-v1/2d53a24c-2b50-4ccd-a07d-fccf1479eca4/g01-ferrari.mp4','mp4','/__l5e/assets-v1/4807c9be-f860-4260-9625-cdc29a224990/g01-ferrari.png',200,true,true,'green'),
  ('Golden Crown','👑','👑',5999,5999,5999,'luxury','pop','/__l5e/assets-v1/16d41ff4-5dc2-4218-945a-665e09f4c3f0/g02-crown.mp4','mp4','/__l5e/assets-v1/7aa47303-386d-49ae-a758-75f94d0561d6/g02-crown.png',201,true,true,'green'),
  ('Rose Bouquet','💐','💐',699,699,699,'romantic','pop','/__l5e/assets-v1/d84be5ad-0d6d-48ef-aa57-3a47f849ec4a/g03-roses.mp4','mp4','/__l5e/assets-v1/be3b9b81-105c-421f-8cc2-373f7695392b/g03-roses.png',202,true,true,'green'),
  ('Diamond Ring','💍','💍',3999,3999,3999,'romantic','pop','/__l5e/assets-v1/360e61d8-eb39-4b42-b479-f79a32bfe72c/g04-ring.mp4','mp4','/__l5e/assets-v1/a51bf0e7-5d82-4494-b77e-03c40d89e5dd/g04-ring.png',203,true,true,'green'),
  ('Private Jet','✈️','✈️',12999,12999,12999,'luxury','pop','/__l5e/assets-v1/36b41252-af76-4b9c-bcdf-ac2f736e8e25/g05-jet.mp4','mp4','/__l5e/assets-v1/f7d3c9ca-773e-407a-a6bd-c47a756445ff/g05-jet.png',204,true,true,'green'),
  ('Fire Phoenix','🔥','🔥',15999,15999,15999,'legendary','pop','/__l5e/assets-v1/264ccd3a-7137-489f-bbf9-ef5f3fdc0ada/g06-phoenix.mp4','mp4','/__l5e/assets-v1/5beebf73-abbb-4bb4-b12b-7195548c7226/g06-phoenix.png',205,true,true,'green'),
  ('Golden Dragon','🐉','🐉',13999,13999,13999,'legendary','pop','/__l5e/assets-v1/203ed6bd-6a10-449d-b135-65fe4ed20f9c/g07-dragon.mp4','mp4','/__l5e/assets-v1/71ce67d6-b44b-4cf5-8d72-9662d14e139c/g07-dragon.png',206,true,true,'green'),
  ('Money Gun','💵','💵',2999,2999,2999,'luxury','pop','/__l5e/assets-v1/79e8b9a4-0f5f-4e08-a331-a4f3b6cd13ff/g08-moneygun.mp4','mp4','/__l5e/assets-v1/23a3e467-bab4-4cb8-bbee-96abe7d689e5/g08-moneygun.png',207,true,true,'green'),
  ('Mega Yacht','🛥️','🛥️',19999,19999,19999,'luxury','pop','/__l5e/assets-v1/c30a1e61-8a46-406e-90df-fdbbd7082eb1/g09-yacht.mp4','mp4','/__l5e/assets-v1/94445f2d-9070-4ae4-bb65-f67899f14c36/g09-yacht.png',208,true,true,'green'),
  ('Rainbow Unicorn','🦄','🦄',4999,4999,4999,'magic','pop','/__l5e/assets-v1/ed3382fa-6c51-4810-912d-357363fb0ec4/g10-unicorn.mp4','mp4','/__l5e/assets-v1/b71b6ef8-48f0-46f3-9a58-14f6f3f8a9d2/g10-unicorn.png',209,true,true,'green'),
  ('Heart Fireworks','🎆','🎆',1999,1999,1999,'romantic','pop','/__l5e/assets-v1/706f9b83-a7f5-4267-8cb8-d92dbda21e24/g11-fireworks.mp4','mp4','/__l5e/assets-v1/a1c76b7f-6876-4c96-8a1f-cb212833a943/g11-fireworks.png',210,true,true,'green'),
  ('Birthday Cake','🎂','🎂',499,499,499,'basic','pop','/__l5e/assets-v1/8e66d3ca-6196-4a02-8612-5bb2827aceac/g12-cake.mp4','mp4','/__l5e/assets-v1/0f98b23a-0059-4a75-b60a-fa7e607ef5e3/g12-cake.png',211,true,true,'green'),
  ('Champagne Pop','🍾','🍾',899,899,899,'luxury','pop','/__l5e/assets-v1/b23d2491-7ab0-42e3-908a-8f16e7d51238/g13-champagne.mp4','mp4','/__l5e/assets-v1/2cd1b9c1-4cce-4470-bb94-33c230537ff5/g13-champagne.png',212,true,true,'green'),
  ('Crystal Castle','🏰','🏰',17999,17999,17999,'legendary','pop','/__l5e/assets-v1/20c0f0dd-f977-4f88-a2c0-de0ee2fd7113/g14-castle.mp4','mp4','/__l5e/assets-v1/97235a0a-92b8-47fc-900e-002755608792/g14-castle.png',213,true,true,'green'),
  ('Golden Peacock','🦚','🦚',4499,4499,4499,'luxury','pop','/__l5e/assets-v1/b537e7a4-e7dd-4a51-ba1a-69b63f185343/g15-peacock.mp4','mp4','/__l5e/assets-v1/abc9004a-e829-4f12-a113-f4180d835adb/g15-peacock.png',214,true,true,'green'),
  ('Ocean Mermaid','🧜','🧜',2999,2999,2999,'magic','pop','/__l5e/assets-v1/93049aad-a9fe-4b38-ac63-02726a217695/g16-mermaid.mp4','mp4','/__l5e/assets-v1/09f5d842-d9bf-4828-917e-d09a328f420e/g16-mermaid.png',215,true,true,'green'),
  ('Mega Heart','❤️','❤️',1299,1299,1299,'romantic','pop','/__l5e/assets-v1/c6cefaca-a496-44e2-af3c-1a553cb90ae7/g17-heart.mp4','mp4','/__l5e/assets-v1/f7f2362a-975a-4dec-90bc-929ca7f707df/g17-heart.png',216,true,true,'green'),
  ('Teddy Balloons','🧸','🧸',399,399,399,'basic','pop','/__l5e/assets-v1/4be27118-7d09-42c1-b450-e47f0c846fde/g18-teddy.mp4','mp4','/__l5e/assets-v1/f7a57fae-23e8-4a5b-8b71-7571844bc75a/g18-teddy.png',217,true,true,'green'),
  ('Lion King','🦁','🦁',9999,9999,9999,'legendary','pop','/__l5e/assets-v1/adab552a-9255-45dc-95bd-7589899eeeab/g19-lion.mp4','mp4','/__l5e/assets-v1/702e84ab-2cf2-4e90-b94d-de0d40840ca6/g19-lion.png',218,true,true,'green'),
  ('Galaxy Portal','🌌','🌌',7999,7999,7999,'magic','pop','/__l5e/assets-v1/a692abb3-837f-4647-8bc9-a9672e17e1c8/g20-galaxy.mp4','mp4','/__l5e/assets-v1/e266586d-98a4-4d45-97dc-8228f8db7c5f/g20-galaxy.png',219,true,true,'green'),
  ('Diamond Waterfall','💎','💎',11999,11999,11999,'luxury','pop','/__l5e/assets-v1/68ea2eb5-3f0d-4956-b3b9-30a698257308/g21-diamondfall.mp4','mp4','/__l5e/assets-v1/b5f894fd-9163-42f1-962c-a9786ecfcf5e/g21-diamondfall.png',220,true,true,'green'),
  ('Angel Descent','😇','😇',6999,6999,6999,'magic','pop','/__l5e/assets-v1/43abb82f-0ecd-4246-a1b3-d9af2543e565/g22-angel.mp4','mp4','/__l5e/assets-v1/634a2e70-1586-4f8c-a0f0-f3cdf47997c4/g22-angel.png',221,true,true,'green'),
  ('Puppy Love','🐶','🐶',299,299,299,'basic','pop','/__l5e/assets-v1/38e3734a-b18a-4fd8-a033-78def73d064d/g23-puppy.mp4','mp4','/__l5e/assets-v1/63e19a4e-d294-4ea6-90a1-7a7e24077fe9/g23-puppy.png',222,true,true,'green'),
  ('Panda Bamboo','🐼','🐼',349,349,349,'basic','pop','/__l5e/assets-v1/5515bc43-41f9-4bb6-842a-5d7c1c8db284/g24-panda.mp4','mp4','/__l5e/assets-v1/64f5bae3-2746-473a-a408-42d9a0a2f83b/g24-panda.png',223,true,true,'green'),
  ('Love Balloon','🎈','🎈',449,449,449,'basic','pop','/__l5e/assets-v1/10e387af-ba45-43ef-b619-a7ecd58f8e08/g25-balloon.mp4','mp4','/__l5e/assets-v1/b21abbc9-3356-4a45-909d-8267bb8a1d8f/g25-balloon.png',224,true,true,'green'),
  ('Genie Lamp','🪔','🪔',1799,1799,1799,'magic','pop','/__l5e/assets-v1/3bae6f26-d86b-4b76-9b5f-a681704ee78f/g26-genie.mp4','mp4','/__l5e/assets-v1/72871df1-a115-427b-9108-4ce4429f0207/g26-genie.png',225,true,true,'green'),
  ('Shooting Star','🌠','🌠',699,699,699,'magic','pop','/__l5e/assets-v1/8d2fbdfa-8442-4fff-8b73-7836f30e160c/g27-star.mp4','mp4','/__l5e/assets-v1/8a6f2ee2-16cc-4287-b819-818fdf9076b9/g27-star.png',226,true,true,'green'),
  ('Crystal Piano','🎹','🎹',5499,5499,5499,'luxury','pop','/__l5e/assets-v1/f1e20f74-cf17-4511-a624-f48e549e0326/g28-piano.mp4','mp4','/__l5e/assets-v1/d55b73c9-c46d-4d1b-89e4-1e2235e16c5c/g28-piano.png',227,true,true,'green'),
  ('Ice Dragon','🧊','🧊',12999,12999,12999,'legendary','pop','/__l5e/assets-v1/b0ae7d0e-0ba6-47c9-be93-223786e508ac/g29-icedragon.mp4','mp4','/__l5e/assets-v1/ff74fc2d-c58a-456b-9287-c67e76627280/g29-icedragon.png',228,true,true,'green'),
  ('Royal Elephant','🐘','🐘',8999,8999,8999,'luxury','pop','/__l5e/assets-v1/98fc03c1-0b71-4265-8bef-db0bc2864eee/g30-elephant.mp4','mp4','/__l5e/assets-v1/9f34e593-6adf-44ba-b92e-5e52072b6e2e/g30-elephant.png',229,true,true,'green'),
  ('Gold Watch','⌚','⌚',3499,3499,3499,'luxury','pop','/__l5e/assets-v1/13dc2fef-3524-4966-a35d-a7d612b00baa/g31-watch.mp4','mp4','/__l5e/assets-v1/13e4d431-28db-46f2-9496-b81890b8272c/g31-watch.png',230,true,true,'green'),
  ('Treasure Chest','🪙','🪙',2499,2499,2499,'luxury','pop','/__l5e/assets-v1/e35199ce-485e-4509-8d95-4e3e024f2172/g32-treasure.mp4','mp4','/__l5e/assets-v1/5f1411c9-946e-4194-b31e-452f4cbd3096/g32-treasure.png',231,true,true,'green'),
  ('Cupid Arrow','🏹','🏹',999,999,999,'romantic','pop','/__l5e/assets-v1/13f765a7-8499-4cdb-87a1-5a255fd9f028/g33-cupid.mp4','mp4','/__l5e/assets-v1/6a196b18-e8e2-4a7a-8857-92137ea6cef0/g33-cupid.png',232,true,true,'green'),
  ('Swan Lake','🦢','🦢',1599,1599,1599,'romantic','pop','/__l5e/assets-v1/448ca204-ac9f-46ab-be61-7ddfe42371f4/g34-swans.mp4','mp4','/__l5e/assets-v1/7fee60d3-8ed6-434c-b1a0-0c2426da677c/g34-swans.png',233,true,true,'green'),
  ('Love Letter','💌','💌',599,599,599,'romantic','pop','/__l5e/assets-v1/b89eccaa-d04f-4f6d-a9d5-1c35ebc507f9/g35-letter.mp4','mp4','/__l5e/assets-v1/5148b0c8-fd59-461b-99d9-8dc8ac2eaba2/g35-letter.png',234,true,true,'green'),
  ('Disco Ball','🪩','🪩',799,799,799,'basic','pop','/__l5e/assets-v1/082d6c19-1678-4de3-bb50-2c26329294ff/g36-disco.mp4','mp4','/__l5e/assets-v1/a3e3480a-fd56-4342-ad39-2f40fb7664f1/g36-disco.png',235,true,true,'green'),
  ('Rocket Launch','🚀','🚀',1899,1899,1899,'magic','pop','/__l5e/assets-v1/8bcb1796-1674-4f6c-9a26-0ce29773965e/g37-rocket.mp4','mp4','/__l5e/assets-v1/0589196f-1f85-43e4-93c9-c7059f931fc3/g37-rocket.png',236,true,true,'green'),
  ('Neon Rider','🏍️','🏍️',3299,3299,3299,'luxury','pop','/__l5e/assets-v1/3c72816a-19fe-4058-b4fa-7e8b1efc8767/g38-bike.mp4','mp4','/__l5e/assets-v1/0bd99a26-c903-4c79-b854-410ec291fb99/g38-bike.png',237,true,true,'green'),
  ('Magic Butterflies','🦋','🦋',899,899,899,'magic','pop','/__l5e/assets-v1/3569255f-91a7-457b-be2f-9d3571f2990f/g39-butterflies.mp4','mp4','/__l5e/assets-v1/dcacb83d-0247-4d87-900d-bc721ce06682/g39-butterflies.png',238,true,true,'green'),
  ('Sakura Bloom','🌸','🌸',549,549,549,'romantic','pop','/__l5e/assets-v1/86209915-2704-49a7-af7a-5792f96ab5d9/g40-sakura.mp4','mp4','/__l5e/assets-v1/80e865c0-e347-4069-ac2f-f9e9973c4aaa/g40-sakura.png',239,true,true,'green'),
  ('Royal Throne','🪑','🪑',14999,14999,14999,'legendary','pop','/__l5e/assets-v1/268f1a21-4872-4407-8828-ae0a2403a451/g41-throne.mp4','mp4','/__l5e/assets-v1/4152c564-614c-485c-96a1-7293b6eae8f8/g41-throne.png',240,true,true,'green'),
  ('White Tiger','🐯','🐯',10999,10999,10999,'legendary','pop','/__l5e/assets-v1/8a7e637e-cec6-4a8c-bf3f-a4a3e6329fad/g42-tiger.mp4','mp4','/__l5e/assets-v1/3cd69da9-c087-4cf3-a636-a27d52e23de5/g42-tiger.png',241,true,true,'green'),
  ('Crystal Chandelier','✨','✨',6499,6499,6499,'luxury','pop','/__l5e/assets-v1/d02d86fa-e88e-4261-a904-fe801efb9227/g43-chandelier.mp4','mp4','/__l5e/assets-v1/a0694890-f6e3-43c7-8ad5-4492542be9e2/g43-chandelier.png',242,true,true,'green'),
  ('Dream Wedding','💒','💒',16999,16999,16999,'romantic','pop','/__l5e/assets-v1/50c5736e-2afb-4bb8-af2b-a1fac8cfe76c/g44-wedding.mp4','mp4','/__l5e/assets-v1/50158f9e-7365-4c8f-9ae8-78b616f80cb7/g44-wedding.png',243,true,true,'green'),
  ('Pegasus Flight','🐴','🐴',8499,8499,8499,'magic','pop','/__l5e/assets-v1/23b84307-c678-407a-8be5-8ca58a6fdf2b/g45-pegasus.mp4','mp4','/__l5e/assets-v1/0e387346-626b-4f0c-9832-1458f337c78a/g45-pegasus.png',244,true,true,'green'),
  ('Emerald Gem','💚','💚',4299,4299,4299,'luxury','pop','/__l5e/assets-v1/0d1496d1-3009-4376-b716-d226cfef894e/g46-emerald.mp4','mp4','/__l5e/assets-v1/afea0e78-78bb-4928-b5a8-55c7d8851b98/g46-emerald.png',245,true,true,'green'),
  ('Luxury Perfume','🌷','🌷',1699,1699,1699,'luxury','pop','/__l5e/assets-v1/38a92d0a-a2bc-481b-8980-4ba03304c107/g47-perfume.mp4','mp4','/__l5e/assets-v1/a1b8a3b1-9776-4e30-9763-70cc796325cc/g47-perfume.png',246,true,true,'green'),
  ('Magic Wizard','🧙','🧙',2199,2199,2199,'magic','pop','/__l5e/assets-v1/2dfc5ea0-67ee-4c77-9b9e-2a91260c5835/g48-wizard.mp4','mp4','/__l5e/assets-v1/bcc9489d-3f5c-4fe5-9475-c2f4baa70642/g48-wizard.png',247,true,true,'green'),
  ('Private Island','🏝️','🏝️',18999,18999,18999,'legendary','pop','/__l5e/assets-v1/a7273cc5-adc0-4c61-994a-57524e0627a4/g49-island.mp4','mp4','/__l5e/assets-v1/a30c4260-51f0-447f-aa32-b98324883437/g49-island.png',248,true,true,'green'),
  ('Diamond Crown','👑','👑',24999,24999,24999,'mythic','pop','/__l5e/assets-v1/d332ff52-ca96-4f4d-bcf2-b85bcfa814b4/g50-diamondcrown.mp4','mp4','/__l5e/assets-v1/4acdbbc1-044c-49d5-bb2b-0a1362283036/g50-diamondcrown.png',249,true,true,'green')
ON CONFLICT DO NOTHING;

UPDATE public.room_top_frames
   SET media_url='/__l5e/assets-v1/e0a0344f-6681-48d2-b753-34784ae2b519/rank1-gold.png',
       media_type='png', chromakey='none', name='JALWA Royal Gold (1st)', updated_at=now()
 WHERE slot=1;

UPDATE public.room_top_frames
   SET media_url='/__l5e/assets-v1/4a93ddd5-c031-4106-846c-3154076609a0/rank2-violet.png',
       media_type='png', chromakey='none', name='JALWA Crystal Violet (2nd)', updated_at=now()
 WHERE slot=2;

INSERT INTO public.room_top_frames (name, media_url, media_type, chromakey, slot, sort_order)
SELECT v.n, v.u, 'png', 'none', 0, v.o FROM (VALUES
  ('JALWA Royal Gold','/__l5e/assets-v1/e0a0344f-6681-48d2-b753-34784ae2b519/rank1-gold.png',0),
  ('JALWA Crystal Violet','/__l5e/assets-v1/4a93ddd5-c031-4106-846c-3154076609a0/rank2-violet.png',0)
) AS v(n,u,o)
WHERE NOT EXISTS (SELECT 1 FROM public.room_top_frames f WHERE f.media_url=v.u AND f.slot=0);

NOTIFY pgrst, 'reload schema';
