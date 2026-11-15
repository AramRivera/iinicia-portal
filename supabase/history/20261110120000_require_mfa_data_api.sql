BEGIN;

-- No reemplazar controles de otro proyecto o ambiente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting AS settings
    CROSS JOIN LATERAL unnest(settings.setconfig) AS config(entry)
    WHERE settings.setrole IN (0, 'authenticator'::regrole::oid)
      AND settings.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      AND split_part(config.entry, '=', 1) = 'pgrst.db_pre_request'
      AND split_part(config.entry, '=', 2) NOT IN ('', 'public.iinicia_require_mfa')
  ) THEN
    RAISE EXCEPTION 'Ya existe pgrst.db_pre_request. Integra iinicia_require_mfa en el hook existente.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.iinicia_require_mfa()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Completa la verificación en dos pasos.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.iinicia_require_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iinicia_require_mfa() TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.iinicia_require_mfa';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
