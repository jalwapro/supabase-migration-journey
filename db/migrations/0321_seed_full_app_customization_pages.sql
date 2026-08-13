-- Full application page catalog for the Admin Customization Studio.
-- This only creates/updates customization metadata; it does not alter user-app routes or business logic.
INSERT INTO public.app_customization_pages
  (page_key,name,description,route_pattern,page_type,status,is_system,is_enabled,is_home,sort_order,configuration)
VALUES
('home','Home','Main application home page','/','app','active',true,true,true,10,'{}'),
('discover','Discover','Discover and explore content','/discover','app','active',true,true,false,20,'{}'),
('live','Live','Live streams and rooms','/live','app','active',true,true,false,30,'{}'),
('rooms','Rooms','Voice and video room browser','/rooms','app','active',true,true,false,40,'{}'),
('my-rooms','My Rooms','Rooms created or managed by the current user','/my-rooms','app','active',true,true,false,50,'{}'),
('wallet','Wallet','Wallet and balance','/wallet','app','active',true,true,false,60,'{}'),
('recharge','Recharge','Coin recharge','/recharge','app','active',true,true,false,70,'{}'),
('recharge-history','Recharge History','Recharge transaction history','/recharge-history','app','active',true,true,false,80,'{}'),
('withdraw','Withdraw','Withdrawal page','/withdraw','app','active',true,true,false,90,'{}'),
('gifts','Gifts','Gift gallery and gifting','/gifts','app','active',true,true,false,100,'{}'),
('rank','Rankings','User and room rankings','/rank','app','active',true,true,false,110,'{}'),
('messages','Messages','Private messages and conversations','/messages','app','active',true,true,false,120,'{}'),
('notifications','Notifications','User notifications','/notifications','app','active',true,true,false,130,'{}'),
('profile','Profile','User profile','/profile','app','active',true,true,false,140,'{}'),
('gallery','Gallery','User media gallery','/gallery','app','active',true,true,false,150,'{}'),
('visitors','Visitors','Profile visitors','/visitors','app','active',true,true,false,160,'{}'),
('games','Games','Application games','/games','app','active',true,true,false,170,'{}'),
('games-leaderboard','Games Leaderboard','Game rankings and leaderboard','/games/leaderboard','app','active',true,true,false,180,'{}'),
('privacy','Privacy','Privacy settings and policy UI','/privacy','app','active',true,true,false,190,'{}'),
('settings','Settings','Application settings','/settings','app','active',true,true,false,200,'{}'),
('splash','Splash Screen','Splash screen and startup experience','/splash','system','active',true,true,false,210,'{}'),
('login','Login','Authentication login screen','/login','auth','active',true,true,false,220,'{}'),
('register','Register','Authentication registration screen','/register','auth','active',true,true,false,230,'{}'),
('voice-room','Voice Room','Voice room visual layout','/room/:roomId','room','active',true,true,false,240,'{"mode":"voice"}'),
('video-room','Video Room','Video room visual layout','/room/:roomId','room','active',true,true,false,250,'{"mode":"video"}'),
('pk-battle','PK Battle','PK battle visual layout','/room/:roomId/pk','room','active',true,true,false,260,'{"mode":"pk"}')
ON CONFLICT (page_key) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  route_pattern=EXCLUDED.route_pattern,
  page_type=EXCLUDED.page_type,
  is_enabled=true,
  sort_order=EXCLUDED.sort_order,
  configuration=EXCLUDED.configuration,
  updated_at=NOW();

-- Ensure every catalog page has a stable root section for the visual builder.
INSERT INTO public.app_customization_sections (page_id,section_key,name,section_type,sort_order,visible,props,styles)
SELECT id,'page-root','Page Root','page',0,true,'{}','{}'
FROM public.app_customization_pages p
WHERE p.is_enabled=true
ON CONFLICT (page_id,section_key) DO NOTHING;
