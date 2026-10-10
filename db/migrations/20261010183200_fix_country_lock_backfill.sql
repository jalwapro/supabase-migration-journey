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
    NEW.country := OLD.country;
    NEW.country_code := OLD.country_code;
    NEW.city := OLD.city;
    NEW.country_locked_at := COALESCE(OLD.country_locked_at, OLD.created_at, now());
    RETURN NEW;
  END IF;

  IF NULLIF(BTRIM(NEW.country), '') IS NOT NULL
     OR NULLIF(BTRIM(NEW.country_code), '') IS NOT NULL THEN
    NEW.country_locked_at := COALESCE(NEW.country_locked_at, now());
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.profiles
SET country_locked_at = COALESCE(country_locked_at, created_at, now())
WHERE country_locked_at IS NULL
  AND (
    NULLIF(BTRIM(country), '') IS NOT NULL
    OR NULLIF(BTRIM(country_code), '') IS NOT NULL
  );
