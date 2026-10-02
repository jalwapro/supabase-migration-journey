-- Runtime application/domain configuration.
-- Public clients read this configuration so changing the primary domain in
-- Admin > Settings does not require code edits for generated app URLs.
INSERT INTO public.app_kv (key, value)
VALUES (
  'runtime_config',
  jsonb_build_object(
    'primary_domain', 'https://www.jalwa.pro',
    'alternate_domains', jsonb_build_array('https://jalwa.pro'),
    'native_bootstrap_domain', 'https://www.jalwa.pro',
    'canonical_redirect', false,
    'support_email', 'admin@jalwa.pro'
  )
)
ON CONFLICT (key) DO NOTHING;
