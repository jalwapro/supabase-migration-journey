-- Fix: admin panel me "Integrations" (Economy → PKR per diamond, host share, Agora keys)
-- aur "Payment Accounts" ki settings show nahi ho rahi thi.
--
-- Root cause: code `app_settings` table par key/value shape maan ke query kar raha tha
-- (`.select("key,value").in("key", ...)` / `.upsert({key, value})`), lekin asli
-- `public.app_settings` ek singleton table hai (`id = 'global'`, fixed columns:
-- splash_enabled, splash_image, ...). Wahan koi `key`/`value` column hai hi nahi,
-- to har query 400 return karti thi aur Integrations page permanent loader par
-- atka rehta tha → diamond price / economy fields kabhi render hi nahi hote the.
--
-- Fix: ek proper key/value table `public.app_kv` banao aur admin pages usko use karein.
-- Singleton `app_settings` splash/spin/custom-theme ke liye jaisa hai waisa rehta hai.

CREATE TABLE IF NOT EXISTS public.app_kv (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_kv TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_kv TO authenticated;
GRANT ALL ON public.app_kv TO service_role;

ALTER TABLE public.app_kv ENABLE ROW LEVEL SECURITY;

-- Publicly readable (Agora keys chahiye edge function ko bhi; secrets sirf trusted
-- admin panel me set hote hain — sensitive keys chahiye to policy tighten kar dena).
DROP POLICY IF EXISTS "app_kv read all" ON public.app_kv;
CREATE POLICY "app_kv read all"
  ON public.app_kv FOR SELECT
  USING (true);

-- Sirf admins likh sakte hain.
DROP POLICY IF EXISTS "app_kv admin insert" ON public.app_kv;
CREATE POLICY "app_kv admin insert"
  ON public.app_kv FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "app_kv admin update" ON public.app_kv;
CREATE POLICY "app_kv admin update"
  ON public.app_kv FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "app_kv admin delete" ON public.app_kv;
CREATE POLICY "app_kv admin delete"
  ON public.app_kv FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_app_kv_updated_at ON public.app_kv;
CREATE TRIGGER trg_app_kv_updated_at
  BEFORE UPDATE ON public.app_kv
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sensible defaults so Economy card values are visible immediately.
INSERT INTO public.app_kv (key, value) VALUES
  ('economy',     '{"pkrPerCoin": 0.5, "pkrPerDiamond": 1, "hostGiftShare": 0.6}'::jsonb),
  ('branding',    '{"appName": "", "tagline": ""}'::jsonb),
  ('agora_voice', '{"appId": "", "appCertificate": ""}'::jsonb),
  ('agora_video', '{"appId": "", "appCertificate": ""}'::jsonb),
  ('agora',       '{"appId": "", "appCertificate": ""}'::jsonb),
  ('payments',    '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
