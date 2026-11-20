DO $$
DECLARE
  client_role text;
  entry record;
  permission text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR entry IN
      SELECT rel FROM (
        VALUES ('admission_applications'), ('audit_logs'), ('campus_access_logs'),
          ('cms_contents'), ('contact_messages'), ('course_mappings'),
          ('enrollment_requests'), ('institutional_directory'), ('permissions'),
          ('profiles'), ('programs'), ('role_permissions'), ('roles'),
          ('system_settings'), ('user_programs'), ('user_roles'), ('wp_migration_inventory')
      ) AS portal_tables(rel)
    LOOP
      FOREACH permission IN ARRAY ARRAY['TRUNCATE', 'TRIGGER', 'REFERENCES'] LOOP
        IF has_table_privilege(client_role, 'public.' || entry.rel, permission) THEN
          RAISE EXCEPTION 'Permiso % inesperado de % en %', permission, client_role, entry.rel;
        END IF;
      END LOOP;
    END LOOP;
    IF has_table_privilege(client_role, 'public.audit_logs', 'INSERT,UPDATE,DELETE')
       OR has_table_privilege(client_role, 'public.campus_access_logs', 'INSERT,UPDATE,DELETE')
       OR has_table_privilege(client_role, 'public.contact_messages', 'INSERT') THEN
      RAISE EXCEPTION 'Permisos inesperados de escritura para %', client_role;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.audit_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.campus_access_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.contact_messages', 'INSERT')
     OR NOT has_table_privilege('anon', 'public.programs', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE') THEN
    RAISE EXCEPTION 'Falta un permiso legítimo de la integración';
  END IF;
END
$$;

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('ba000000-0000-4000-8000-000000000001', 'pending-security@example.test'),
  ('ba000000-0000-4000-8000-000000000002', 'suspended-security@example.test');
UPDATE public.profiles SET status = 'suspendido' WHERE id = 'ba000000-0000-4000-8000-000000000002';

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Un aspirante pendiente conserva el acceso a su perfil con AAL2';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Un usuario AAL1 no debe leer el perfil directamente';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Una cuenta suspendida no debe leer datos protegidos con un JWT vigente';
  END IF;
END
$$;

ROLLBACK;
