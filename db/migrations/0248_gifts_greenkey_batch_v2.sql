-- Update the 20 greenkey batch gifts to point to v2 videos (subject natural colors, pure green background)
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/16f6010e-f1a7-421a-9e8c-9969ce6f48f3/gk2-01-sports-car.mp4'    WHERE name = 'Jalwa Sports Car';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/4d9aebfe-9911-4c59-813d-b9924f8eed29/gk2-02-private-jet.mp4'   WHERE name = 'Jalwa Private Jet';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/5fe0c9ff-ea27-46e9-8b97-fae55520d8a0/gk2-03-mega-yacht.mp4'    WHERE name = 'Jalwa Mega Yacht';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/210e2747-eecc-4ab4-a05a-4bf488ada842/gk2-04-mansion.mp4'       WHERE name = 'Jalwa Mansion';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/9fe563be-6927-47ef-adbe-46db29582a9c/gk2-05-gold-rolex.mp4'    WHERE name = 'Jalwa Gold Rolex';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/050e7184-24b8-491e-bcab-a7b1b956e185/gk2-06-rose-bouquet.mp4'  WHERE name = 'Jalwa Rose Bouquet';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/0040adf5-58b5-4548-9e85-2f37c4801237/gk2-07-diamond-ring.mp4'  WHERE name = 'Jalwa Diamond Ring';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/c34931e8-1549-48cb-913b-fc2a4a65fc7c/gk2-08-couple-kiss.mp4'   WHERE name = 'Jalwa Couple Kiss';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/ae494799-b98d-4fee-a204-889f22be36ef/gk2-09-love-letter.mp4'   WHERE name = 'Jalwa Love Letter';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/147b4cb7-9f99-4162-86c7-e9e832168517/gk2-10-swan-pair.mp4'     WHERE name = 'Jalwa Swan Pair';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/9bc498ee-e2f1-443d-9add-c44ff3776199/gk2-11-fireworks.mp4'     WHERE name = 'Jalwa Fireworks';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/20002f0d-2c5a-4d36-8067-7135315d366b/gk2-12-birthday-cake.mp4' WHERE name = 'Jalwa Birthday Cake';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/693f638c-6de0-4853-9154-956646fa3b90/gk2-13-champagne-pop.mp4' WHERE name = 'Jalwa Champagne Pop';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/8b233b93-7633-437e-935b-ec516c2ecd46/gk2-14-confetti-burst.mp4' WHERE name = 'Jalwa Confetti Burst';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/fcd218b9-292e-426a-83a9-8216773c6ca3/gk2-15-disco-ball.mp4'    WHERE name = 'Jalwa Disco Ball';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/57f029a5-eb04-4155-9475-adaa56852147/gk2-16-dragon.mp4'        WHERE name = 'Jalwa Golden Dragon';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/16788186-84a4-40ba-bfd9-0fd2209c2a93/gk2-17-phoenix.mp4'       WHERE name = 'Jalwa Phoenix Rising';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/3574fc55-bcdf-4e0f-a6a8-aec3f022555d/gk2-18-unicorn.mp4'       WHERE name = 'Jalwa Rainbow Unicorn';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/2373b1fe-dcf8-4ef7-8411-e2092c492754/gk2-19-mermaid.mp4'       WHERE name = 'Jalwa Mermaid';
UPDATE public.gifts SET clip_path = '/__l5e/assets-v1/814dea4c-780b-4773-bcfc-8f0f6ceb9beb/gk2-20-wizard.mp4'        WHERE name = 'Jalwa Wizard Spell';

NOTIFY pgrst, 'reload schema';
