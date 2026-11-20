BEGIN;

-- Estos privilegios operan fuera de RLS y no los necesita ningún cliente del portal.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.admission_applications, public.audit_logs, public.campus_access_logs,
  public.cms_contents, public.contact_messages, public.course_mappings,
  public.enrollment_requests, public.institutional_directory, public.permissions,
  public.profiles, public.programs, public.role_permissions, public.roles,
  public.system_settings, public.user_programs, public.user_roles,
  public.wp_migration_inventory
FROM PUBLIC, anon, authenticated;

-- La API y los disparadores internos son las únicas fuentes de eventos.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs, public.campus_access_logs
FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs;
DROP POLICY IF EXISTS campus_access_logs_insert_own_or_admin ON public.campus_access_logs;

-- El formulario pasa por la validación y el límite de solicitudes de NestJS.
REVOKE INSERT ON public.contact_messages FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS contact_insert_public ON public.contact_messages;

-- La comprobación de estado consulta solo al titular de la sesión y evita recursión en profiles.
CREATE FUNCTION iinicia_private.portal_session_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status IN ('activo', 'pendiente')
    );
$$;
REVOKE ALL ON FUNCTION iinicia_private.portal_session_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION iinicia_private.portal_session_allowed() TO authenticated;

DO $$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'admission_applications', 'audit_logs', 'campus_access_logs', 'contact_messages',
    'course_mappings', 'enrollment_requests', 'profiles', 'role_permissions',
    'system_settings', 'user_programs', 'user_roles'
  ] LOOP
    EXECUTE pg_catalog.format(
      'CREATE POLICY require_portal_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING ((SELECT iinicia_private.portal_session_allowed()))
       WITH CHECK ((SELECT iinicia_private.portal_session_allowed()))',
      protected_table
    );
  END LOOP;
END
$$;

COMMIT;
