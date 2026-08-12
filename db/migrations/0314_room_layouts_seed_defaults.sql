-- Seed editable Jalwa Room Layout Studio defaults.
-- Safe to run more than once: each layout is inserted only when a matching
-- system layout name/type does not already exist.

INSERT INTO public.room_layouts
  (name, type, description, layout_json, status, version, is_default)
SELECT
  'Jalwa Voice — 20 Seats',
  'voice',
  'Default editable 20-seat voice room layout.',
  jsonb_build_object(
    'version', 1,
    'canvas', jsonb_build_object('width', 390, 'height', 844),
    'background', jsonb_build_object('type', 'color', 'value', '#0a0a0f'),
    'elements', (
      jsonb_build_array(
        jsonb_build_object('id','room-header','type','room-header','x',0,'y',0,'width',390,'height',80,'zIndex',10,'visible',true,'locked',true),
        jsonb_build_object('id','ranking-bar','type','room-announcement','x',0,'y',80,'width',390,'height',40,'zIndex',9,'visible',true,'locked',true)
      )
      || COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', 'seat-' || n, 'type', 'seat',
            'x', 8 + ((n - 1) % 5) * 77,
            'y', 145 + ((n - 1) / 5) * 88,
            'width', 70, 'height', 78, 'zIndex', 20,
            'visible', true, 'locked', false,
            'borderRadius', 18,
            'data', jsonb_build_object('seatNumber', n)
          ) ORDER BY n
        ) FROM generate_series(1,20) AS n
      ), '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object('id','chat-panel','type','chat-panel','x',10,'y',650,'width',370,'height',110,'zIndex',40,'visible',true,'locked',false)
      )
    )
  ),
  'draft', 1, false
WHERE NOT EXISTS (SELECT 1 FROM public.room_layouts WHERE name = 'Jalwa Voice — 20 Seats' AND type = 'voice');

INSERT INTO public.room_layouts
  (name, type, description, layout_json, status, version, is_default)
SELECT
  'Jalwa Video — 4 Participants',
  'video',
  'Default editable video room layout.',
  jsonb_build_object(
    'version', 1,
    'canvas', jsonb_build_object('width', 390, 'height', 844),
    'background', jsonb_build_object('type', 'color', 'value', '#0a0a0f'),
    'elements', jsonb_build_array(
      jsonb_build_object('id','room-header','type','room-header','x',0,'y',0,'width',390,'height',80,'zIndex',10,'visible',true,'locked',true),
      jsonb_build_object('id','video-1','type','video-participant','x',10,'y',100,'width',180,'height',300,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','video-2','type','video-participant','x',200,'y',100,'width',180,'height',300,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','video-3','type','video-participant','x',10,'y',410,'width',180,'height',220,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','video-4','type','video-participant','x',200,'y',410,'width',180,'height',220,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','chat-panel','type','chat-panel','x',10,'y',650,'width',370,'height',110,'zIndex',40,'visible',true,'locked',false)
    )
  ),
  'draft', 1, false
WHERE NOT EXISTS (SELECT 1 FROM public.room_layouts WHERE name = 'Jalwa Video — 4 Participants' AND type = 'video');

INSERT INTO public.room_layouts
  (name, type, description, layout_json, status, version, is_default)
SELECT
  'Jalwa PK Battle',
  'pk',
  'Default editable PK battle layout.',
  jsonb_build_object(
    'version', 1,
    'canvas', jsonb_build_object('width', 390, 'height', 844),
    'background', jsonb_build_object('type', 'color', 'value', '#0a0a0f'),
    'elements', jsonb_build_array(
      jsonb_build_object('id','room-header','type','room-header','x',0,'y',0,'width',390,'height',70,'zIndex',10,'visible',true,'locked',true),
      jsonb_build_object('id','pk-player-a','type','pk-player','x',10,'y',100,'width',170,'height',260,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','pk-player-b','type','pk-player','x',210,'y',100,'width',170,'height',260,'zIndex',20,'visible',true,'locked',false),
      jsonb_build_object('id','pk-vs','type','pk-vs-logo','x',165,'y',190,'width',60,'height',60,'zIndex',30,'visible',true,'locked',false),
      jsonb_build_object('id','pk-score','type','pk-score-bar','x',20,'y',380,'width',350,'height',55,'zIndex',25,'visible',true,'locked',false),
      jsonb_build_object('id','pk-progress','type','pk-progress-bar','x',20,'y',450,'width',350,'height',18,'zIndex',25,'visible',true,'locked',false),
      jsonb_build_object('id','pk-timer','type','pk-timer','x',145,'y',490,'width',100,'height',50,'zIndex',30,'visible',true,'locked',false),
      jsonb_build_object('id','chat-panel','type','chat-panel','x',10,'y',650,'width',370,'height',110,'zIndex',40,'visible',true,'locked',false)
    )
  ),
  'draft', 1, false
WHERE NOT EXISTS (SELECT 1 FROM public.room_layouts WHERE name = 'Jalwa PK Battle' AND type = 'pk');

NOTIFY pgrst, 'reload schema';
