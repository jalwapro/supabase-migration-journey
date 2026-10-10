-- Lock a user's country/city after the first location assignment.
-- Existing country values are preserved and become immutable; new values are supplied
-- by the GPS-only profile flow, not editable text fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.profiles_lock_country_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NULLIF(BTRIM(NEW.country), '') IS NOT NULL
       OR NULLIF(BTRIM(NEW.country_code), '') IS NOT NULL THEN
      NEW.country_locked_at := COALESCE(NEW.country_locked_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.country_locked_at IS NOT NULL
     OR NULLIF(BTRIM(OLD.country), '') IS NOT NULL
     OR NULLIF(BTRIM(OLD.country_code), '') IS NOT NULL THEN
    -- Country identity is immutable, including city, even for direct API updates.
    NEW.country := OLD.country;
    NEW.country_code := OLD.country_code;
    NEW.city := OLD.city;
    NEW.country_locked_at := OLD.country_locked_at;
    RETURN NEW;
  END IF;

  IF NULLIF(BTRIM(NEW.country), '') IS NOT NULL
     OR NULLIF(BTRIM(NEW.country_code), '') IS NOT NULL THEN
    NEW.country_locked_at := COALESCE(NEW.country_locked_at, now());
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_lock_country_location ON public.profiles;
CREATE TRIGGER profiles_lock_country_location
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_lock_country_location();

COMMENT ON COLUMN public.profiles.country_locked_at IS
  'Set once when a country is assigned; country, country_code and city are immutable afterwards.';
