-- 0301_minigames_seed.sql — catalogue for the 10 launch games
begin;

insert into public.mini_games
  (slug, name, description, icon, color, category, entry_cost, reward_base, xp_reward,
   daily_limit, cooldown_seconds, difficulty, min_duration_ms, max_duration_ms, max_score, sort_order, config)
values
  ('daily_spin','Daily Spin','Free spin every 24 hours — win coins instantly','🎡','#ffcf6a','luck',
   0, 0, 20, 1, 86400, 'easy', 800, 120000, 0, 10,
   '{"mode":"weighted","prizes":[
      {"label":"100 Coins","coins":100,"mult":0,"weight":30},
      {"label":"250 Coins","coins":250,"mult":0,"weight":24},
      {"label":"500 Coins","coins":500,"mult":0,"weight":16},
      {"label":"1,000 Coins","coins":1000,"mult":0,"weight":9},
      {"label":"2,500 Coins","coins":2500,"mult":0,"weight":4},
      {"label":"5,000 Coins","coins":5000,"mult":0,"weight":1},
      {"label":"50 Coins","coins":50,"mult":0,"weight":16}]}'::jsonb),

  ('lucky_box','Lucky Box','Open the daily mystery box for a surprise reward','🎁','#ff5fa2','luck',
   0, 0, 20, 1, 86400, 'easy', 600, 120000, 0, 20,
   '{"mode":"weighted","prizes":[
      {"label":"Bronze Box · 150","coins":150,"mult":0,"weight":34},
      {"label":"Silver Box · 400","coins":400,"mult":0,"weight":26},
      {"label":"Gold Box · 900","coins":900,"mult":0,"weight":18},
      {"label":"Diamond Box · 2,000","coins":2000,"mult":0,"weight":8},
      {"label":"Royal Box · 6,000","coins":6000,"mult":0,"weight":2},
      {"label":"Starter Box · 80","coins":80,"mult":0,"weight":12}]}'::jsonb),

  ('memory_match','Memory Match','Flip and match all pairs before the clock runs out','🧠','#7c5cff','brain',
   200, 200, 15, 20, 5, 'medium', 4000, 300000, 2000, 30,
   '{"mode":"score","pairs":8,"seconds":60,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":70,"mult":2,"label":"2x"},
      {"min":90,"mult":3,"label":"3x"},
      {"min":100,"mult":5,"label":"5x Perfect"}]}'::jsonb),

  ('tap_challenge','Tap Challenge','Tap as fast as you can for 10 seconds','👆','#22d3ee','arcade',
   100, 100, 10, 30, 5, 'easy', 9000, 60000, 400, 40,
   '{"mode":"score","seconds":10,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":45,"mult":1,"label":"1x"},
      {"min":70,"mult":2,"label":"2x"},
      {"min":95,"mult":3,"label":"3x"},
      {"min":120,"mult":5,"label":"5x Legend"}]}'::jsonb),

  ('reaction_speed','Reaction Speed','Tap the moment the screen turns green','⚡','#f97316','arcade',
   100, 100, 10, 30, 5, 'medium', 2000, 120000, 1000, 50,
   '{"mode":"score","rounds":5,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":65,"mult":2,"label":"2x"},
      {"min":85,"mult":3,"label":"3x"},
      {"min":95,"mult":5,"label":"5x Lightning"}]}'::jsonb),

  ('puzzle_challenge','Puzzle Challenge','Slide the tiles back into order','🧩','#34d399','brain',
   300, 300, 25, 15, 10, 'hard', 8000, 600000, 1000, 60,
   '{"mode":"score","size":3,"seconds":120,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":50,"mult":1,"label":"1x"},
      {"min":75,"mult":2,"label":"2x"},
      {"min":90,"mult":4,"label":"4x"},
      {"min":100,"mult":6,"label":"6x Master"}]}'::jsonb),

  ('math_challenge','Math Challenge','Solve as many equations as possible in 45s','➗','#60a5fa','brain',
   200, 200, 15, 20, 5, 'medium', 5000, 180000, 500, 70,
   '{"mode":"score","seconds":45,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":65,"mult":2,"label":"2x"},
      {"min":85,"mult":3,"label":"3x"},
      {"min":100,"mult":5,"label":"5x Genius"}]}'::jsonb),

  ('word_puzzle','Word Puzzle','Unscramble the hidden words','🔤','#e879f9','brain',
   200, 200, 15, 20, 5, 'medium', 5000, 300000, 500, 80,
   '{"mode":"score","rounds":6,"seconds":90,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":70,"mult":2,"label":"2x"},
      {"min":90,"mult":3,"label":"3x"},
      {"min":100,"mult":5,"label":"5x Wordsmith"}]}'::jsonb),

  ('quiz_battle','Quiz Battle','10 quick-fire questions, beat the clock','❓','#fbbf24','brain',
   300, 300, 25, 15, 10, 'hard', 8000, 300000, 500, 90,
   '{"mode":"score","questions":10,"seconds":10,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":60,"mult":2,"label":"2x"},
      {"min":80,"mult":4,"label":"4x"},
      {"min":100,"mult":6,"label":"6x Champion"}]}'::jsonb),

  ('color_match','Color Match','Does the word match the colour? Decide fast','🎨','#f43f5e','arcade',
   150, 150, 12, 25, 5, 'medium', 5000, 180000, 500, 100,
   '{"mode":"score","seconds":40,"tiers":[
      {"min":0,"mult":0,"label":"No reward"},
      {"min":40,"mult":1,"label":"1x"},
      {"min":65,"mult":2,"label":"2x"},
      {"min":85,"mult":3,"label":"3x"},
      {"min":100,"mult":5,"label":"5x Flawless"}]}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  category = excluded.category,
  config = excluded.config,
  updated_at = now();

commit;
