-- Ejecutar como postgres en una base de pruebas con línea base, migraciones y semillas.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email) VALUES
 ('de000000-0000-4000-8000-000000000001', 'alcance-coord@example.test'),
 ('de000000-0000-4000-8000-000000000002', 'alcance-dentro@example.test'),
 ('de000000-0000-4000-8000-000000000003', 'alcance-fuera@example.test'),
 ('de000000-0000-4000-8000-000000000004', 'alcance-soporte@example.test'),
 ('de000000-0000-4000-8000-000000000005', 'alcance-admin@example.test'),
 ('de000000-0000-4000-8000-000000000006', 'alcance-postulante@example.test');

INSERT INTO public.user_roles (user_id, role_id)
SELECT fixture.user_id::uuid, roles.id
FROM (VALUES
 ('de000000-0000-4000-8000-000000000001', 'coordinador'),
 ('de000000-0000-4000-8000-000000000004', 'soporte'),
 ('de000000-0000-4000-8000-000000000005', 'administrador')
) AS fixture(user_id, slug)
JOIN public.roles ON roles.slug = fixture.slug;

INSERT INTO public.user_programs (user_id, program_id, status) VALUES
 ('de000000-0000-4000-8000-000000000001', '6a7a5d42-97e8-4737-8071-f93cc88227d4', 'inscrito'),
 ('de000000-0000-4000-8000-000000000002', '6a7a5d42-97e8-4737-8071-f93cc88227d4', 'inscrito'),
 ('de000000-0000-4000-8000-000000000002', 'a87fa37d-73ed-4bf8-9fe9-bee188968642', 'inscrito'),
 ('de000000-0000-4000-8000-000000000003', 'a87fa37d-73ed-4bf8-9fe9-bee188968642', 'inscrito');

INSERT INTO public.admission_applications (applicant_id, program_id, status) VALUES
 ('de000000-0000-4000-8000-000000000006', '6a7a5d42-97e8-4737-8071-f93cc88227d4', 'postulado');

INSERT INTO public.enrollment_requests (user_id, course_mapping_id, status) VALUES
 ('de000000-0000-4000-8000-000000000002', 'd67c94c9-9132-4d45-8973-38d18b56307b', 'pendiente'),
 ('de000000-0000-4000-8000-000000000003', '671820a5-88fc-4158-a3e8-c2d2dfcc9ffb', 'pendiente');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.v_user_complete_profile WHERE email LIKE 'alcance-%') <> 3 THEN
   RAISE EXCEPTION 'Coordinación debe ver su perfil, el miembro de su programa y la postulación dentro del ámbito';
 END IF;
 IF (SELECT count(*) FROM public.user_programs WHERE user_id = 'de000000-0000-4000-8000-000000000002') <> 1 THEN
   RAISE EXCEPTION 'Coordinación solo debe ver la pertenencia al programa compartido';
 END IF;
 IF (SELECT count(*) FROM public.enrollment_requests WHERE user_id IN ('de000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000003')) <> 1 THEN
   RAISE EXCEPTION 'Coordinación solo debe ver la matrícula de su programa';
 END IF;
 IF has_table_privilege(current_user, 'public.enrollment_requests', 'UPDATE') THEN
   RAISE EXCEPTION 'El dictamen directo debe estar revocado';
 END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.v_user_complete_profile WHERE email LIKE 'alcance-%') <> 6 THEN
   RAISE EXCEPTION 'Soporte debe conservar el directorio de diagnóstico';
 END IF;
 IF EXISTS (SELECT 1 FROM public.enrollment_requests) OR EXISTS (SELECT 1 FROM public.admission_applications) THEN
   RAISE EXCEPTION 'Soporte no debe leer solicitudes académicas ajenas';
 END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}', true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.v_user_complete_profile WHERE email LIKE 'alcance-%') <> 6 THEN
   RAISE EXCEPTION 'Administración debe conservar la lectura global';
 END IF;
 IF has_table_privilege(current_user, 'public.user_roles', 'INSERT')
    OR has_column_privilege(current_user, 'public.profiles', 'status', 'UPDATE') THEN
   RAISE EXCEPTION 'El rol o el estado no se deben modificar desde la Data API';
 END IF;
 UPDATE public.profiles SET first_name = 'Perfil editable' WHERE id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'La edición del perfil propio debe seguir disponible'; END IF;
END $$;
ROLLBACK;
