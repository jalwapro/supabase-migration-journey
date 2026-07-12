-- Point the "Royal Lion" / "Lion King" gift at the TikTok reference clip
-- (portrait crop, audio boosted +18dB, embedded roar).
-- Clear sound_url so the clip's own audio is the single source of truth.

update public.gifts
set
  clip_path = '/__l5e/assets-v1/cb050052-b115-49d2-b97e-4e1434e880a9/lion-king-tiktok-v2.mp4',
  clip_type = 'mp4',
  sound_url = null
where lower(name) in ('royal lion', 'lion king')
   or lower(name) like '%lion king%'
   or lower(name) like '%royal lion%';
