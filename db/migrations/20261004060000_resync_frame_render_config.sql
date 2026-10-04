-- Re-sync any equipped DP frame whose Shop Studio render config drifted.
UPDATE public.profiles p
SET frame_render_config = COALESCE(t.render_config, '{}'::jsonb)
FROM public.themes t
WHERE p.frame IS NOT NULL
  AND split_part(p.frame, '#', 1) IN (
    split_part(COALESCE(t.animation_url, ''), '#', 1),
    split_part(COALESCE(t.preview_url, ''), '#', 1),
    split_part(COALESCE(t.bg_image, ''), '#', 1)
  )
  AND p.frame_render_config IS DISTINCT FROM COALESCE(t.render_config, '{}'::jsonb);
