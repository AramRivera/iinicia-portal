-- IINICIA Portal · persistencia y sesiones con Supabase · 20261116120000_staff_scope.sql
BEGIN;

-- Las mutaciones administrativas pasan por NestJS para comprobar jerarquía y ámbito.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles, public.enrollment_requests
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (first_name, last_name, phone, avatar_url, bio) ON public.profiles TO authenticated;

-- Los permisos de columna protegen los campos administrativos sin volver a consultar profiles.
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_safe ON public.profiles;
CREATE POLICY profiles_update_own_safe ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE SCHEMA IF NOT EXISTS iinicia_private;
REVOKE ALL ON SCHEMA iinicia_private FROM PUBLIC;
GRANT USAGE ON SCHEMA iinicia_private TO authenticated;

-- La coordinación obtiene ámbito a partir de una afiliación académica vigente que pertenece a su sesión.
CREATE FUNCTION iinicia_private.coordinator_has_program(program uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.has_role('coordinador') AND EXISTS (
    SELECT 1 FROM public.user_programs AS membership
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.program_id = program
      AND membership.status IN ('admitido', 'inscrito', 'cursando')
  )
$$;

-- Una cuenta objetivo queda visible si comparte un programa mediante afiliación, postulación o matrícula.
CREATE FUNCTION iinicia_private.coordinator_can_read_user(person uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_programs AS membership
    WHERE membership.user_id = person
      AND iinicia_private.coordinator_has_program(membership.program_id)
  ) OR EXISTS (
    SELECT 1 FROM public.admission_applications AS application
    WHERE application.applicant_id = person
      AND iinicia_private.coordinator_has_program(application.program_id)
  ) OR EXISTS (
    SELECT 1 FROM public.enrollment_requests AS enrollment
    JOIN public.course_mappings AS course ON course.id = enrollment.course_mapping_id
    WHERE enrollment.user_id = person
      AND iinicia_private.coordinator_has_program(course.program_id)
  )
$$;

-- El catálogo ya consulta matrículas en RLS. Resolver el mapeo aquí evita recursión.
CREATE FUNCTION iinicia_private.coordinator_has_course(mapping uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_mappings AS course
    WHERE course.id = mapping AND iinicia_private.coordinator_has_program(course.program_id)
  )
$$;

REVOKE ALL ON FUNCTION iinicia_private.coordinator_has_program(uuid),
  iinicia_private.coordinator_can_read_user(uuid),
  iinicia_private.coordinator_has_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iinicia_private.coordinator_has_program(uuid),
  iinicia_private.coordinator_can_read_user(uuid),
  iinicia_private.coordinator_has_course(uuid) TO authenticated;

CREATE POLICY staff_scope_profiles ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_can_read_user(id));

CREATE POLICY staff_scope_user_roles ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_can_read_user(user_id));

CREATE POLICY staff_scope_program_memberships ON public.user_programs AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_has_program(program_id));

CREATE POLICY staff_scope_enrollments ON public.enrollment_requests AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR iinicia_private.coordinator_has_course(course_mapping_id));

COMMIT;
