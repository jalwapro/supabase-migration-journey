-- Update 25 Basic gifts to SVG-matched luxury 3D PNG icons.
-- These keep the original SVG object identity while using premium 3D transparent assets.

WITH data(name, image_url) AS (VALUES
  ('Heart', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/5dcd7cc8-b347-4c61-b970-8fe641051105/heart.png'),
  ('Like', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/75d61559-a8b4-4ddd-bd14-d65e6a24b1ce/like.png'),
  ('Rose', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/4af0c801-50c2-4724-9d3f-f6acae6b2fdd/rose.png'),
  ('Chocolate', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/4e611eb1-1f9b-4a5d-bcf6-7f8533e59421/chocolate.png'),
  ('Teddy', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/db8371fd-1669-4437-a3b0-7a00e5a059a6/teddy.png'),
  ('Balloon', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/55fc54c4-02d1-4d27-bacf-b29a9922589b/balloon.png'),
  ('Candy', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/beab77f6-5897-403a-aef4-e06bc733afd3/candy.png'),
  ('Ice Cream', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/1de12a77-e195-4ac9-89c2-8204022c10c8/icecream.png'),
  ('Coffee', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/424f7ade-6c10-4755-82f0-0351a6738bb9/coffee.png'),
  ('Ring', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/bbbab963-e2ad-4ab2-9146-2977d21e79df/ring.png'),
  ('Cake', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/67e5b2cd-172f-44fa-afd2-4b5c34448d7b/cake.png'),
  ('Fire', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/2f9ede74-b806-49b4-8be5-a3077dbd06f5/fire.png'),
  ('Kiss', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/17e0e4a0-4962-4126-88f7-4b715028f4c1/kiss.png'),
  ('Star', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/fa3d1fd5-0617-426e-b04c-5e76999f0261/star.png'),
  ('Butterfly', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/f57b6adf-81ab-447b-b355-f9915da2616c/butterfly.png'),
  ('Gift Box', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/ed171f27-14ff-42a1-9bc4-887d3d8c76bf/giftbox.png'),
  ('Love Letter', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/215ed770-2556-4df9-8258-45c62a71a898/loveletter.png'),
  ('Crystal Heart', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/ce118bcc-b8e2-4ed4-8c56-90efa878408d/crystalheart.png'),
  ('Snowflake', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/3cbbe9ac-3377-4c25-8035-2227bb1a47cf/snowflake.png'),
  ('Rainbow', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c11b77c8-5188-4632-b001-9e8f21d2e3db/rainbow.png'),
  ('Crown', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/4a0f0be5-b614-4f0c-b16a-e495e31fe44e/crown.png'),
  ('Magic Wand', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/20ebad5e-2fcf-4842-8d7e-4507761f8219/magicwand.png'),
  ('Sky Lantern', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/75f194c4-5c69-4fbb-a0ea-e2c1bd37136b/skylantern.png'),
  ('Confetti', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/18d5044b-14af-45e7-981f-9b4863b0dba9/confetti.png'),
  ('Rocket', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/159964e0-d709-4b5a-b7f8-2170d347a4ad/rocket.png')
)
UPDATE public.gifts AS g
SET image_url = data.image_url,
    clip_type = 'svg'
FROM data
WHERE g.name = data.name;