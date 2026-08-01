-- Attach the rendered green-screen clips (Cloudflare R2) to batch 3 gifts.
update public.gifts g
set clip_path = 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch3/clips/'
      || replace(lower(g.name), ' ', '-') || '.mp4',
    preview_url = 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch3/clips/'
      || replace(lower(g.name), ' ', '-') || '.mp4',
    clip_type = 'mp4',
    chromakey = 'green',
    duration_ms = 5000,
    loop = false
where g.batch_name = 'batch3_premium';
