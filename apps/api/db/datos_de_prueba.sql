-- =====================================================================
-- SEED DE DATOS DE PRUEBA · IINICIA · Supabase (DEV) - CORREGIDO
-- =====================================================================
begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) PROGRAMAS (usamos WHERE NOT EXISTS para evitar ON CONFLICT)
-- ---------------------------------------------------------------------
insert into public.programs
(code, slug, name, type, summary, description, duration_hours, is_published, is_active, sort_order)
select * from (values
                   ('LIC-ISC-01', 'licenciatura-sistemas', 'Licenciatura en Ingeniería en Sistemas Computacionales',
                    'degree'::public.program_type, 'Formación integral en desarrollo de software y redes.',
                    'Programa de 8 semestres con enfoque en desarrollo de software, bases de datos y seguridad.',
                    3200, true, true, 1),
                   ('DIP-CIB-01', 'diplomado-ciberseguridad', 'Diplomado en Ciberseguridad',
                    'diploma'::public.program_type, 'Especialización práctica en seguridad ofensiva y defensiva.',
                    'Diplomado de 6 meses con laboratorios y certificaciones intermedias.',
                    240, true, true, 2),
                   ('CERT-AWS-01', 'certificacion-aws-cloud', 'Certificación AWS Cloud Practitioner',
                    'certification'::public.program_type, 'Preparación para la certificación oficial de AWS.',
                    'Curso intensivo de preparación con simuladores de examen.',
                    80, true, true, 3),
                   ('CUR-PY-01', 'curso-python-basico', 'Curso de Python Básico',
                    'course'::public.program_type, 'Introducción a la programación con Python.',
                    'Curso corto de 40 horas, ideal para principiantes.',
                    40, false, true, 4)
              ) as v(code, slug, name, type, summary, description, duration_hours, is_published, is_active, sort_order)
where not exists (select 1 from public.programs p where p.code = v.code);

-- ---------------------------------------------------------------------
-- 2) COURSE MAPPINGS
-- ---------------------------------------------------------------------
insert into public.course_mappings
(program_id, moodle_course_id, moodle_shortname, moodle_fullname, is_active)
select
    (select id from public.programs where code = v.program_code),
    v.moodle_course_id, v.moodle_shortname, v.moodle_fullname, true
from (values
          ('LIC-ISC-01', 101, 'ISC-PROG1-2024', 'Programación I - 2024'),
          ('DIP-CIB-01', 102, 'CIB-ETHACK-2024', 'Ethical Hacking - 2024'),
          ('CERT-AWS-01', 103, 'AWS-CP-2024', 'AWS Cloud Practitioner - 2024'),
          (null, 104, 'GEN-IND-2024', 'Inducción General 2024')
     ) as v(program_code, moodle_course_id, moodle_shortname, moodle_fullname)
where not exists (
    select 1 from public.course_mappings cm where cm.moodle_course_id = v.moodle_course_id
);

-- ---------------------------------------------------------------------
-- 3) USUARIOS EN auth.users
--    IMPORTANTE: sin ON CONFLICT (id) porque auth.users tiene índices
--    parciales y el SQL Editor a veces no infiere bien. Usamos NOT EXISTS.
-- ---------------------------------------------------------------------
insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
)
select * from (values
                   ('11111111-1111-1111-1111-111111111111'::uuid,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    'authenticated', 'authenticated',
                    'admin@iinicia.mx', crypt('Password123!', gen_salt('bf')),
                    now(), now(), now(),
                    '{"provider":"email","providers":["email"]}'::jsonb,
                    '{"first_name":"Ana","last_name":"García","phone":"+525512345678"}'::jsonb,
                    false),
                   ('22222222-2222-2222-2222-222222222222'::uuid,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    'authenticated', 'authenticated',
                    'estudiante@iinicia.mx', crypt('Password123!', gen_salt('bf')),
                    now(), now(), now(),
                    '{"provider":"email","providers":["email"]}'::jsonb,
                    '{"first_name":"Luis","last_name":"Pérez","phone":"+525598765432"}'::jsonb,
                    false),
                   ('33333333-3333-3333-3333-333333333333'::uuid,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    'authenticated', 'authenticated',
                    'coordinador@iinicia.mx', crypt('Password123!', gen_salt('bf')),
                    now(), now(), now(),
                    '{"provider":"email","providers":["email"]}'::jsonb,
                    '{"first_name":"María","last_name":"López","phone":"+525511122233"}'::jsonb,
                    false)
              ) as v(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
where not exists (select 1 from auth.users u where u.id = v.id);

-- ---------------------------------------------------------------------
-- 3.1) profile_details (por si el trigger no las creó)
-- ---------------------------------------------------------------------
insert into public.profile_details (user_id, country_code, state, city)
select v.user_id, v.country_code, v.state, v.city
from (values
          ('11111111-1111-1111-1111-111111111111'::uuid, 'MX', 'CDMX', 'Ciudad de México'),
          ('22222222-2222-2222-2222-222222222222'::uuid, 'MX', 'JAL',  'Guadalajara'),
          ('33333333-3333-3333-3333-333333333333'::uuid, 'MX', 'NL',   'Monterrey')
     ) as v(user_id, country_code, state, city)
where not exists (select 1 from public.profile_details pd where pd.user_id = v.user_id);

-- ---------------------------------------------------------------------
-- 3.2) Activar Ana y María
-- ---------------------------------------------------------------------
update public.profiles
set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333')
  and status <> 'active';

-- ---------------------------------------------------------------------
-- 4) ROLES ASIGNADOS
--    Orden importante para respetar guard_role_grant:
--    (a) Ana primero SIN actor (el trigger no evalúa si v_actor es null)
--    (b) Luego fijamos actor = Ana (ya tiene rank 100)
--    (c) Luego Luis y María (el trigger valida contra Ana)
-- ---------------------------------------------------------------------

-- (a) Ana: superadmin, SIN actor y SIN granted_by
insert into public.user_roles (user_id, role_id, program_id, granted_by)
select '11111111-1111-1111-1111-111111111111', r.id, null, null
from public.roles r
where r.code = 'superadmin'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = '11111111-1111-1111-1111-111111111111'
      and ur.role_id = r.id and ur.program_id is null
);

-- (b) Ahora Ana ya es superadmin (rank 100)
select set_config('app.actor_id', '11111111-1111-1111-1111-111111111111', true);

-- (c) Luis: student
insert into public.user_roles (user_id, role_id, program_id, granted_by)
select '22222222-2222-2222-2222-222222222222', r.id, null,
       '11111111-1111-1111-1111-111111111111'
from public.roles r
where r.code = 'student'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = '22222222-2222-2222-2222-222222222222'
      and ur.role_id = r.id and ur.program_id is null
);

-- (d) María: coordinator del diplomado
insert into public.user_roles (user_id, role_id, program_id, granted_by)
select '33333333-3333-3333-3333-333333333333', r.id,
       (select id from public.programs where code = 'DIP-CIB-01'),
       '11111111-1111-1111-1111-111111111111'
from public.roles r
where r.code = 'coordinator'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = '33333333-3333-3333-3333-333333333333'
      and ur.role_id = r.id
      and ur.program_id = (select id from public.programs where code = 'DIP-CIB-01')
);

-- ---------------------------------------------------------------------
-- 5) USER_PROGRAMS
-- ---------------------------------------------------------------------
insert into public.user_programs
(user_id, program_id, status, applied_at, admitted_at, enrolled_at)
select '22222222-2222-2222-2222-222222222222',
       (select id from public.programs where code = 'LIC-ISC-01'),
       'enrolled', now() - interval '60 days', now() - interval '45 days', now() - interval '30 days'
where not exists (
    select 1 from public.user_programs up
    where up.user_id = '22222222-2222-2222-2222-222222222222'
  and up.program_id = (select id from public.programs where code = 'LIC-ISC-01')
    );

insert into public.user_programs
(user_id, program_id, status, applied_at, notes)
select '22222222-2222-2222-2222-222222222222',
       (select id from public.programs where code = 'DIP-CIB-01'),
       'applicant', now() - interval '5 days', 'Solicitud pendiente de revisión por coordinación.'
where not exists (
    select 1 from public.user_programs up
    where up.user_id = '22222222-2222-2222-2222-222222222222'
  and up.program_id = (select id from public.programs where code = 'DIP-CIB-01')
    );

-- ---------------------------------------------------------------------
-- 6) ENROLLMENT_REQUESTS (con NOT EXISTS, sin ON CONFLICT)
-- ---------------------------------------------------------------------
insert into public.enrollment_requests
(user_id, course_mapping_id, user_program_id, requested_role, status,
 requested_by, reviewed_by, reviewed_at, synced_at)
select
    '22222222-2222-2222-2222-222222222222',
    (select id from public.course_mappings where moodle_course_id = 101),
    (select id from public.user_programs
     where user_id = '22222222-2222-2222-2222-222222222222'
       and program_id = (select id from public.programs where code = 'LIC-ISC-01')),
    'student'::public.enrollment_role, 'synced'::public.enrollment_status,
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    now() - interval '20 days', now() - interval '19 days'
where not exists (
    select 1 from public.enrollment_requests er
    where er.user_id = '22222222-2222-2222-2222-222222222222'
  and er.course_mapping_id = (select id from public.course_mappings where moodle_course_id = 101)
  and er.status in ('pending','approved','synced')
    );

insert into public.enrollment_requests
(user_id, course_mapping_id, requested_role, status,
 requested_by, reviewed_by, reviewed_at)
select
    '22222222-2222-2222-2222-222222222222',
    (select id from public.course_mappings where moodle_course_id = 102),
    'student'::public.enrollment_role, 'approved'::public.enrollment_status,
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    now() - interval '2 days'
where not exists (
    select 1 from public.enrollment_requests er
    where er.user_id = '22222222-2222-2222-2222-222222222222'
  and er.course_mapping_id = (select id from public.course_mappings where moodle_course_id = 102)
  and er.status in ('pending','approved','synced')
    );

insert into public.enrollment_requests
(user_id, course_mapping_id, requested_role, status, requested_by)
select
    '22222222-2222-2222-2222-222222222222',
    (select id from public.course_mappings where moodle_course_id = 103),
    'student'::public.enrollment_role, 'pending'::public.enrollment_status,
    '22222222-2222-2222-2222-222222222222'
    where not exists (
  select 1 from public.enrollment_requests er
  where er.user_id = '22222222-2222-2222-2222-222222222222'
    and er.course_mapping_id = (select id from public.course_mappings where moodle_course_id = 103)
    and er.status in ('pending','approved','synced')
);

-- ---------------------------------------------------------------------
-- 7) VERIFICACIÓN
-- ---------------------------------------------------------------------
do $$
declare
v_programs int; v_courses int; v_profiles int; v_roles int; v_userprog int; v_enroll int;
begin
select count(*) into v_programs from public.programs where code in ('LIC-ISC-01','DIP-CIB-01','CERT-AWS-01','CUR-PY-01');
select count(*) into v_courses  from public.course_mappings where moodle_course_id in (101,102,103,104);
select count(*) into v_profiles from public.profiles where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
select count(*) into v_roles    from public.user_roles where user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
select count(*) into v_userprog from public.user_programs where user_id = '22222222-2222-2222-2222-222222222222';
select count(*) into v_enroll   from public.enrollment_requests where user_id = '22222222-2222-2222-2222-222222222222';

raise notice 'programs: %, course_mappings: %, profiles: %, user_roles: %, user_programs: %, enrollment_requests: %',
    v_programs, v_courses, v_profiles, v_roles, v_userprog, v_enroll;
end $$;

commit;