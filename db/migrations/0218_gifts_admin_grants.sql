-- Admin panel needs INSERT/UPDATE/DELETE on gifts. RLS ("Admins manage gifts")
-- already restricts writes to admin role; grants were missing.
GRANT INSERT, UPDATE, DELETE ON public.gifts TO authenticated;
NOTIFY pgrst, 'reload schema';
