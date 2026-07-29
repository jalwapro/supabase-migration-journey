-- 0257: Replace placeholder entrance previews with real cinematic artwork (CDN) and
-- add 6 new premium cinematic entrances.

DO $$
DECLARE
  base text := 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/';
BEGIN
  UPDATE entrance_effects SET thumbnail_url = base || '156d0a06-1031-4721-b3a1-f376dcb55819/vip-gate.jpg'          WHERE media_url = 'builtin:vip_gate';
  UPDATE entrance_effects SET thumbnail_url = base || 'a62f703b-ea29-4c9a-a0ed-f32cb791b3f2/royal-arrival.jpg'     WHERE media_url = 'builtin:royal_arrival';
  UPDATE entrance_effects SET thumbnail_url = base || '48720598-d57f-4868-ae13-b1df96a0e992/king-throne.jpg'       WHERE media_url = 'builtin:king_throne';
  UPDATE entrance_effects SET thumbnail_url = base || '9b3c9d32-67c2-4711-9182-fd8e843d984f/queen-diadem.jpg'      WHERE media_url = 'builtin:queen_diadem';
  UPDATE entrance_effects SET thumbnail_url = base || '32e7e258-2852-48ff-9abd-d240028bdfd6/diamond-explosion.jpg' WHERE media_url = 'builtin:diamond_burst';
  UPDATE entrance_effects SET thumbnail_url = base || 'ff150674-482a-488f-8780-c977a6350609/galaxy-warp.jpg'       WHERE media_url = 'builtin:galaxy_warp';
  UPDATE entrance_effects SET thumbnail_url = base || '8123167f-1ec5-417d-92bf-0cc647de88d4/flying-dragon.jpg'     WHERE media_url = 'builtin:flying_dragon';
  UPDATE entrance_effects SET thumbnail_url = base || '4315cec2-8592-495a-8dfc-88159d60265c/phoenix-rebirth.jpg'   WHERE media_url = 'builtin:phoenix_rebirth';
  UPDATE entrance_effects SET thumbnail_url = base || '996667da-f1c4-4cf4-8866-29dcc759876c/angel-descent.jpg'     WHERE media_url = 'builtin:angel_descend';
  UPDATE entrance_effects SET thumbnail_url = base || '3720e6fd-9d8b-4061-98ae-5f926ca213a0/demon-summon.jpg'      WHERE media_url = 'builtin:demon_summon';
  UPDATE entrance_effects SET thumbnail_url = base || 'e710d795-173a-412b-8181-1335b28ba70a/lightning-storm.jpg'   WHERE media_url = 'builtin:lightning_storm';
  UPDATE entrance_effects SET thumbnail_url = base || '3ae670c9-6bd7-4bfb-97bd-970d19c8982c/space-portal.jpg'      WHERE media_url = 'builtin:space_portal';
  UPDATE entrance_effects SET thumbnail_url = base || '0345b7a9-e22b-46cb-8304-1a12b7cb723f/fire-gate.jpg'         WHERE media_url = 'builtin:fire_gate';
  UPDATE entrance_effects SET thumbnail_url = base || 'd076fc7e-3021-4e2f-a816-e6d933507a6a/ice-shatter.jpg'       WHERE media_url = 'builtin:ice_shatter';
  UPDATE entrance_effects SET thumbnail_url = base || 'c0959b61-b39c-470a-8e84-55adae2826e1/luxury-gold-gate.jpg'  WHERE media_url = 'builtin:luxury_gold';
  UPDATE entrance_effects SET thumbnail_url = base || '9eaef0d7-9cd6-4100-a481-f4ad9aaa15ba/neon-cyber.jpg'        WHERE media_url = 'builtin:neon_cyber';
  UPDATE entrance_effects SET thumbnail_url = base || 'aa5ba797-ae50-4750-92df-4fd00423d9f7/future-tech.jpg'       WHERE media_url = 'builtin:future_tech';
  UPDATE entrance_effects SET thumbnail_url = base || '2d8d6fd5-e952-4ce0-acf4-5f386a534539/festival-burst.jpg'    WHERE media_url = 'builtin:festival_burst';
  UPDATE entrance_effects SET thumbnail_url = base || '3065d449-48b6-43fc-896c-9263b52bfb98/romantic-petals.jpg'   WHERE media_url = 'builtin:romantic_petals';
  UPDATE entrance_effects SET thumbnail_url = base || '67a5a2f5-fc0a-40aa-9b3d-dc6cdf0a389a/jalwa-exclusive.jpg'   WHERE media_url = 'builtin:jalwa_exclusive';

  -- New cinematic entrances (rendered artwork used as both preview and in-room visual)
  INSERT INTO entrance_effects (key, name, description, category, media_url, media_type, thumbnail_url, chromakey, duration_ms, price_coins, min_vip_level, sort_order)
  VALUES
    ('golden_lion', 'Golden Lion', 'A roaring golden lion announces your arrival.', 'Beast',
      base || '10cc582f-b8c3-4171-9bfa-d9491aa702b2/golden-lion.jpg', 'svg',
      base || '10cc582f-b8c3-4171-9bfa-d9491aa702b2/golden-lion.jpg', 'none', 2800, 26000, 4, 21),
    ('white_tiger', 'White Tiger', 'A frost white tiger leaps into the room.', 'Beast',
      base || '56032da8-d04c-485d-a3f5-8618e0746b1d/white-tiger.jpg', 'svg',
      base || '56032da8-d04c-485d-a3f5-8618e0746b1d/white-tiger.jpg', 'none', 2800, 24000, 4, 22),
    ('luxury_sports_car', 'Luxury Sports Car', 'Drift in with a golden supercar.', 'Luxury',
      base || '162613c3-7019-4535-8c8f-c454db3e82e5/luxury-sports-car.jpg', 'svg',
      base || '162613c3-7019-4535-8c8f-c454db3e82e5/luxury-sports-car.jpg', 'none', 2800, 32000, 5, 23),
    ('private_jet', 'Private Jet Landing', 'Your gold private jet touches down.', 'Luxury',
      base || '1123ebf0-b167-4a0e-bf77-e7b9f1057e6d/private-jet.jpg', 'svg',
      base || '1123ebf0-b167-4a0e-bf77-e7b9f1057e6d/private-jet.jpg', 'none', 2800, 38000, 5, 24),
    ('luxury_yacht', 'Luxury Yacht', 'Sail in on a mega yacht under fireworks.', 'Luxury',
      base || '0c17297c-c3f7-44a9-b29b-f31c7bb92054/luxury-yacht.jpg', 'svg',
      base || '0c17297c-c3f7-44a9-b29b-f31c7bb92054/luxury-yacht.jpg', 'none', 2800, 42000, 5, 25),
    ('unicorn_magic', 'Unicorn Magic', 'A rainbow unicorn gallops through the room.', 'Fantasy',
      base || '8e324d21-e102-4fee-893e-238481b6101d/unicorn-magic.jpg', 'svg',
      base || '8e324d21-e102-4fee-893e-238481b6101d/unicorn-magic.jpg', 'none', 2600, 20000, 3, 26)
  ON CONFLICT (key) DO UPDATE
    SET thumbnail_url = EXCLUDED.thumbnail_url,
        media_url = EXCLUDED.media_url,
        is_active = true;
END $$;
