-- Agora ID pool with auto-rotation when minutes run out.
-- 3 kinds (voice / video / pk), up to 20 slots each. Server picks the
-- lowest-index active slot with remaining quota. Exhausted slots go inactive
-- and the next slot takes over automatically.

CREATE TABLE IF NOT EXISTS public.agora_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('voice','video','pk')),
  slot_index int NOT NULL CHECK (slot_index BETWEEN 1 AND 20),
  label text,
  app_id text NOT NULL,
  app_certificate text NOT NULL,
  minutes_quota numeric NOT NULL DEFAULT 10000,
  minutes_used numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  exhausted_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slot_index)
);

CREATE INDEX IF NOT EXISTS agora_slots_pick_idx
  ON public.agora_slots (kind, is_active, slot_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agora_slots TO authenticated;
GRANT ALL ON public.agora_slots TO service_role;

ALTER TABLE public.agora_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage agora slots" ON public.agora_slots;
CREATE POLICY "admins manage agora slots" ON public.agora_slots
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Atomic slot picker: picks lowest-index active slot for the kind that still
-- has room for _minutes, increments usage, and marks it inactive if the
-- reservation pushes it past its quota. Returns 0 rows if no slot available.
CREATE OR REPLACE FUNCTION public.consume_agora_slot(_kind text, _minutes numeric)
RETURNS TABLE (app_id text, app_certificate text, slot_index int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.agora_slots%ROWTYPE;
BEGIN
  SELECT * INTO s
    FROM public.agora_slots
   WHERE kind = _kind
     AND is_active = true
     AND minutes_used + COALESCE(_minutes, 0) <= minutes_quota
   ORDER BY slot_index ASC
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.agora_slots
     SET minutes_used  = minutes_used + COALESCE(_minutes, 0),
         last_used_at  = now(),
         updated_at    = now(),
         is_active     = CASE WHEN minutes_used + COALESCE(_minutes, 0) >= minutes_quota THEN false ELSE true END,
         exhausted_at  = CASE WHEN minutes_used + COALESCE(_minutes, 0) >= minutes_quota AND exhausted_at IS NULL THEN now() ELSE exhausted_at END
   WHERE id = s.id;

  app_id := s.app_id;
  app_certificate := s.app_certificate;
  slot_index := s.slot_index;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_agora_slot(text, numeric) TO authenticated, service_role;
