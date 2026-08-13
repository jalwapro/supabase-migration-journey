-- Dedicated storage for Admin App Customization assets.
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-customization-assets', 'app-customization-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS customization_assets_admin_select ON storage.objects;
DROP POLICY IF EXISTS customization_assets_admin_insert ON storage.objects;
DROP POLICY IF EXISTS customization_assets_admin_update ON storage.objects;
DROP POLICY IF EXISTS customization_assets_admin_delete ON storage.objects;

CREATE POLICY customization_assets_admin_select
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-customization-assets' AND public.room_layout_admin());

CREATE POLICY customization_assets_admin_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-customization-assets' AND public.room_layout_admin());

CREATE POLICY customization_assets_admin_update
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-customization-assets' AND public.room_layout_admin())
WITH CHECK (bucket_id = 'app-customization-assets' AND public.room_layout_admin());

CREATE POLICY customization_assets_admin_delete
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-customization-assets' AND public.room_layout_admin());
