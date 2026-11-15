BEGIN;

-- Requires the current portal schema, including admission_applications and roles.slug.
CREATE POLICY admissions_limit_read_scope ON public.admission_applications
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  applicant_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (
    public.has_role('coordinador')
    AND EXISTS (
      SELECT 1 FROM public.user_programs AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.program_id = admission_applications.program_id
        AND membership.status IN ('admitido', 'inscrito', 'cursando')
    )
  )
);

-- Keep even preexisting permissive policies from granting direct writes.
REVOKE INSERT, UPDATE, DELETE ON public.admission_applications FROM PUBLIC, anon, authenticated;
CREATE POLICY admissions_insert_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY admissions_update_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY admissions_delete_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- Memberships grant scope. Route writes through the API, which checks the actor.
REVOKE INSERT, UPDATE, DELETE ON public.user_programs FROM PUBLIC, anon, authenticated;
CREATE POLICY user_programs_insert_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY user_programs_update_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY user_programs_delete_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.iinicia_review_admission(
  application_id uuid,
  reviewer_id uuid,
  decision public.academic_status,
  notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  application public.admission_applications;
  previous_status public.academic_status;
  student_role_id smallint;
  applicant_status public.user_status;
BEGIN
  IF decision IS NULL OR decision NOT IN ('en_revision', 'admitido', 'rechazado') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Dictamen no válido.';
  END IF;

  SELECT * INTO application
  FROM public.admission_applications AS a
  WHERE a.id = application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Postulación no encontrada.';
  END IF;

  IF reviewer_id = application.applicant_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS reviewer
    WHERE reviewer.id = reviewer_id AND reviewer.status = 'activo'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Dictamen no permitido.';
  END IF;

  IF NOT public.has_role('superadministrador', reviewer_id) THEN
    IF NOT public.has_permission('admissions.review', reviewer_id) OR NOT (
      public.is_admin(reviewer_id)
      OR (
        public.has_role('coordinador', reviewer_id)
        AND EXISTS (
          SELECT 1 FROM public.user_programs AS membership
          WHERE membership.user_id = reviewer_id
            AND membership.program_id = application.program_id
            AND membership.status IN ('admitido', 'inscrito', 'cursando')
        )
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Dictamen fuera de ámbito.';
    END IF;
  END IF;

  previous_status := application.status;
  IF previous_status = 'admitido' AND decision <> 'admitido' THEN
    RAISE EXCEPTION 'Una admisión confirmada requiere un proceso de baja para revertirse.';
  END IF;

  IF decision = 'admitido' THEN
    SELECT p.status INTO applicant_status FROM public.profiles AS p
    WHERE p.id = application.applicant_id FOR UPDATE;

    IF applicant_status IS NULL OR applicant_status NOT IN ('activo', 'pendiente') THEN
      RAISE EXCEPTION 'La cuenta del aspirante requiere revisión administrativa.';
    END IF;

    SELECT r.id INTO student_role_id FROM public.roles AS r WHERE r.slug = 'estudiante';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'No existe el rol estudiante.';
    END IF;

    INSERT INTO public.user_programs AS membership (user_id, program_id, status, authorized_by)
    VALUES (application.applicant_id, application.program_id, 'admitido', reviewer_id)
    ON CONFLICT (user_id, program_id) DO UPDATE SET
      status = EXCLUDED.status, authorized_by = EXCLUDED.authorized_by
    WHERE membership.status IN ('postulado', 'en_revision', 'rechazado');

    IF EXISTS (
      SELECT 1 FROM public.user_programs AS membership
      WHERE membership.user_id = application.applicant_id
        AND membership.program_id = application.program_id
        AND membership.status IN ('baja', 'suspendido')
    ) THEN
      RAISE EXCEPTION 'El programa del aspirante requiere revisión administrativa.';
    END IF;

    UPDATE public.profiles SET status = 'activo'
    WHERE id = application.applicant_id AND status = 'pendiente';

    INSERT INTO public.user_roles AS assignment (user_id, role_id, assigned_by, is_active)
    VALUES (application.applicant_id, student_role_id, reviewer_id, true)
    ON CONFLICT (user_id, role_id) DO UPDATE SET
      is_active = true, expires_at = NULL, assigned_by = EXCLUDED.assigned_by, assigned_at = now()
    WHERE NOT assignment.is_active OR assignment.expires_at <= now();
  END IF;

  IF previous_status = decision AND application.reviewer_notes IS NOT DISTINCT FROM notes
    AND application.reviewed_at IS NOT NULL THEN
    RETURN to_jsonb(application);
  END IF;

  UPDATE public.admission_applications AS a SET
    status = decision,
    reviewer_id = iinicia_review_admission.reviewer_id,
    reviewer_notes = notes,
    reviewed_at = now()
  WHERE a.id = application_id
  RETURNING a.* INTO application;

  INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, old_values, new_values)
  VALUES (
    reviewer_id, application.applicant_id, 'ADMISSION_REVIEWED', 'admission_applications',
    application.id::text, jsonb_build_object('status', previous_status), jsonb_build_object('status', decision)
  );

  RETURN to_jsonb(application);
END;
$$;

REVOKE ALL ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
