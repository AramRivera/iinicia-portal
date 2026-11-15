-- Esquema inicial de IINICIA.
-- Revisar antes de aplicar manualmente desde el SQL Editor de Supabase.
-- La credencial privilegiada de Supabase puede omitir RLS.

BEGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  deactivated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT profiles_deactivation_state_check CHECK (
    (status = 'active' AND deactivated_at IS NULL AND deactivated_by IS NULL)
    OR (status = 'inactive' AND deactivated_at IS NOT NULL AND deactivated_by IS NOT NULL)
  )
);

CREATE TABLE public.roles (
  code text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_check CHECK (
    code IN (
      'superadmin',
      'admin',
      'coordinator',
      'teacher',
      'student',
      'applicant',
      'support'
    )
  )
);

INSERT INTO public.roles (code, description)
VALUES
  ('superadmin', 'Administración global del sistema'),
  ('admin', 'Administración institucional según permisos'),
  ('coordinator', 'Operación limitada a programas asignados'),
  ('teacher', 'Docencia limitada a cursos asignados'),
  ('student', 'Acceso a programas y cursos autorizados'),
  ('applicant', 'Gestión de información y seguimiento de admisión'),
  ('support', 'Acceso operativo limitado')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  role_code text NOT NULL REFERENCES public.roles (code) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_code)
);

CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programs_code_nonempty_check CHECK (length(btrim(code)) > 0),
  CONSTRAINT programs_name_nonempty_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT programs_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.user_programs (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES public.programs (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_programs_pkey PRIMARY KEY (user_id, program_id),
  CONSTRAINT user_programs_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.course_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs (id) ON DELETE RESTRICT,
  moodle_course_id integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_mappings_moodle_course_id_check CHECK (moodle_course_id > 0),
  CONSTRAINT course_mappings_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.moodle_user_mappings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE RESTRICT,
  moodle_user_id integer UNIQUE,
  desired_status text NOT NULL DEFAULT 'active',
  sync_status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moodle_user_mappings_user_id_check CHECK (
    moodle_user_id IS NULL OR moodle_user_id > 0
  ),
  CONSTRAINT moodle_user_mappings_sync_status_check CHECK (
    sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT moodle_user_mappings_desired_status_check CHECK (
    desired_status IN ('active', 'inactive')
  ),
  CONSTRAINT moodle_user_mappings_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT moodle_user_mappings_synced_check CHECK (
    sync_status <> 'synced'
    OR (moodle_user_id IS NOT NULL AND last_synced_at IS NOT NULL)
  ),
  CONSTRAINT moodle_user_mappings_failed_error_check CHECK (
    sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  )
);

CREATE TABLE public.course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  course_mapping_id uuid NOT NULL REFERENCES public.course_mappings (id) ON DELETE RESTRICT,
  assignment_status text NOT NULL DEFAULT 'active',
  moodle_sync_status text NOT NULL DEFAULT 'pending',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_assignments_teacher_course_key UNIQUE (teacher_id, course_mapping_id),
  CONSTRAINT course_assignments_status_check CHECK (
    assignment_status IN ('active', 'revoked')
  ),
  CONSTRAINT course_assignments_sync_status_check CHECK (
    moodle_sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT course_assignments_revocation_check CHECK (
    (assignment_status = 'active' AND revoked_at IS NULL)
    OR (assignment_status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT course_assignments_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT course_assignments_synced_check CHECK (
    moodle_sync_status <> 'synced' OR last_synced_at IS NOT NULL
  ),
  CONSTRAINT course_assignments_failed_error_check CHECK (
    moodle_sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  )
);

CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  course_mapping_id uuid NOT NULL REFERENCES public.course_mappings (id) ON DELETE RESTRICT,
  decision_status text NOT NULL DEFAULT 'submitted',
  sync_status text,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  last_sync_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_requests_decision_status_check CHECK (
    decision_status IN ('submitted', 'approved', 'rejected')
  ),
  CONSTRAINT enrollment_requests_sync_status_check CHECK (
    sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT enrollment_requests_review_state_check CHECK (
    (decision_status = 'submitted'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND sync_status IS NULL)
    OR (decision_status = 'approved'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND sync_status IS NOT NULL)
    OR (decision_status = 'rejected'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND sync_status IS NULL)
  ),
  CONSTRAINT enrollment_requests_synced_check CHECK (
    (sync_status = 'synced' AND synced_at IS NOT NULL)
    OR (sync_status IS DISTINCT FROM 'synced' AND synced_at IS NULL)
  ),
  CONSTRAINT enrollment_requests_failed_error_check CHECK (
    sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  ),
  CONSTRAINT enrollment_requests_attempt_count_check CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX enrollment_requests_one_open_per_student_course_idx
  ON public.enrollment_requests (student_id, course_mapping_id)
  WHERE decision_status IN ('submitted', 'approved');

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action_code text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_code_nonempty_check CHECK (length(btrim(action_code)) > 0),
  CONSTRAINT audit_logs_target_type_nonempty_check CHECK (length(btrim(target_type)) > 0),
  CONSTRAINT audit_logs_target_id_nonempty_check CHECK (length(btrim(target_id)) > 0),
  CONSTRAINT audit_logs_details_object_check CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX user_roles_role_code_idx
  ON public.user_roles (role_code, user_id);
CREATE INDEX user_programs_program_status_idx
  ON public.user_programs (program_id, status, user_id);
CREATE INDEX course_mappings_program_status_idx
  ON public.course_mappings (program_id, status);
CREATE INDEX course_assignments_course_status_idx
  ON public.course_assignments (course_mapping_id, assignment_status);
CREATE INDEX course_assignments_sync_attempt_idx
  ON public.course_assignments (moodle_sync_status, last_attempt_at);
CREATE INDEX moodle_user_mappings_sync_attempt_idx
  ON public.moodle_user_mappings (sync_status, last_attempt_at);
CREATE INDEX enrollment_requests_student_created_idx
  ON public.enrollment_requests (student_id, created_at DESC);
CREATE INDEX enrollment_requests_course_states_idx
  ON public.enrollment_requests (course_mapping_id, decision_status, sync_status);
CREATE INDEX audit_logs_actor_created_idx
  ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_target_created_idx
  ON public.audit_logs (target_type, target_id, created_at DESC);

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER programs_touch_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_programs_touch_updated_at
  BEFORE UPDATE ON public.user_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER course_mappings_touch_updated_at
  BEFORE UPDATE ON public.course_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER moodle_user_mappings_touch_updated_at
  BEFORE UPDATE ON public.moodle_user_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER course_assignments_touch_updated_at
  BEFORE UPDATE ON public.course_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER enrollment_requests_touch_updated_at
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, status)
  VALUES (NEW.id, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_code, assigned_by)
  VALUES (NEW.id, 'applicant', NULL)
  ON CONFLICT (user_id, role_code) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;

CREATE TRIGGER iinicia_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.status = 'active'
  );
$$;

CREATE FUNCTION public.has_role(_role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role_code = _role_code
    );
$$;

CREATE FUNCTION public.is_coordinator_for_program(_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role('coordinator')
    AND EXISTS (
      SELECT 1
      FROM public.user_programs AS up
      JOIN public.programs AS p ON p.id = up.program_id
      WHERE up.user_id = (SELECT auth.uid())
        AND up.program_id = _program_id
        AND up.status = 'active'
        AND p.status = 'active'
    );
$$;

CREATE FUNCTION public.is_student_in_program(_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role('student')
    AND EXISTS (
      SELECT 1
      FROM public.user_programs AS up
      JOIN public.programs AS p ON p.id = up.program_id
      WHERE up.user_id = (SELECT auth.uid())
        AND up.program_id = _program_id
        AND up.status = 'active'
        AND p.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_coordinator_for_program(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_student_in_program(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator_for_program(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_in_program(uuid) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodle_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self_active
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) AND (SELECT public.is_active_user()));

CREATE POLICY roles_select_active_users
  ON public.roles FOR SELECT TO authenticated
  USING ((SELECT public.is_active_user()));

CREATE POLICY user_roles_select_self
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_active_user()));

CREATE POLICY programs_select_active_catalog
  ON public.programs FOR SELECT TO authenticated
  USING (status = 'active' AND (SELECT public.is_active_user()));

CREATE POLICY user_programs_select_self_or_coordinator_scope
  ON public.user_programs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      user_id = (SELECT auth.uid())
      OR (SELECT public.is_coordinator_for_program(program_id))
    )
  );

CREATE POLICY course_mappings_select_active_catalog
  ON public.course_mappings FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (SELECT public.is_active_user())
    AND EXISTS (
      SELECT 1
      FROM public.programs AS p
      WHERE p.id = program_id
        AND p.status = 'active'
    )
  );

CREATE POLICY course_assignments_select_authorized_scope
  ON public.course_assignments FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      (
        teacher_id = (SELECT auth.uid())
        AND assignment_status = 'active'
        AND moodle_sync_status = 'synced'
        AND (SELECT public.has_role('teacher'))
        AND EXISTS (
          SELECT 1
          FROM public.course_mappings AS cm
          WHERE cm.id = course_mapping_id
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.course_mappings AS cm
        WHERE cm.id = course_mapping_id
          AND (SELECT public.is_coordinator_for_program(cm.program_id))
      )
    )
  );

CREATE POLICY enrollment_requests_select_self_or_coordinator_scope
  ON public.enrollment_requests FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      student_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.course_mappings AS cm
        WHERE cm.id = course_mapping_id
          AND (SELECT public.is_coordinator_for_program(cm.program_id))
      )
    )
  );

CREATE POLICY enrollment_requests_insert_own_student_request
  ON public.enrollment_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND decision_status = 'submitted'
    AND sync_status IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND (SELECT public.is_active_user())
    AND (SELECT public.has_role('student'))
    AND EXISTS (
      SELECT 1
      FROM public.course_mappings AS cm
      WHERE cm.id = course_mapping_id
        AND cm.status = 'active'
        AND (SELECT public.is_student_in_program(cm.program_id))
    )
  );

CREATE POLICY audit_logs_select_admins
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      (SELECT public.has_role('superadmin'))
      OR (SELECT public.has_role('admin'))
    )
  );

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE
  public.profiles,
  public.roles,
  public.user_roles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.moodle_user_mappings,
  public.course_assignments,
  public.enrollment_requests,
  public.audit_logs
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.profiles,
  public.roles,
  public.user_roles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.course_assignments,
  public.enrollment_requests,
  public.audit_logs
TO authenticated;

GRANT INSERT (student_id, course_mapping_id)
  ON TABLE public.enrollment_requests TO authenticated;

GRANT SELECT ON TABLE public.roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.profiles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.moodle_user_mappings,
  public.course_assignments,
  public.enrollment_requests
TO service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.user_roles TO service_role;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

COMMENT ON TABLE public.profiles IS
  'Perfil mínimo de aplicación relacionado con Supabase Auth; baja lógica mediante status.';
COMMENT ON TABLE public.user_roles IS
  'Roles de aplicación; no deben ser asignados directamente por el cliente.';
COMMENT ON TABLE public.moodle_user_mappings IS
  'Mapeo mínimo de identidad a Moodle; nunca almacena contraseña ni token.';
COMMENT ON TABLE public.course_mappings IS
  'Referencia de cursos Moodle para una única instancia activa en la primera versión.';
COMMENT ON TABLE public.enrollment_requests IS
  'Solicitud, decisión y estado de sincronización Moodle separados.';
COMMENT ON TABLE public.audit_logs IS
  'Auditoría de operaciones sensibles; los detalles deben estar sanitizados.';

COMMIT;
