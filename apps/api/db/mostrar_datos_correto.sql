select * from public.v_admin_users;
select * from public.v_my_courses;   -- como Luis (necesitas JWT de Luis)
select * from public.audit_logs order by occurred_at desc limit 20;

-- =====================================================================
-- INSPECCIÓN RÁPIDA · IINICIA · Supabase (DEV)
-- Ejecuta cada bloque por separado o todo de una vez.
-- =====================================================================

-- 1) Catálogos base
select 'roles' as tabla, * from public.roles order by rank desc;
select 'permissions' as tabla, * from public.permissions order by code;
select 'role_permissions' as tabla, * from public.role_permissions order by role_id, permission_id;

-- 2) Oferta académica
select 'programs' as tabla, * from public.programs order by sort_order;
select 'course_mappings' as tabla, * from public.course_mappings order by moodle_course_id;

-- 3) Usuarios
select 'profiles' as tabla, * from public.profiles order by created_at desc;
select 'profile_details' as tabla, * from public.profile_details;
select 'user_roles' as tabla, * from public.user_roles order by created_at desc;
select 'user_programs' as tabla, * from public.user_programs order by created_at desc;

-- 4) Académico
select 'enrollment_requests' as tabla, * from public.enrollment_requests order by created_at desc;

-- 5) Auditoría
select 'audit_logs' as tabla, * from public.audit_logs order by occurred_at desc limit 50;


select 'roles' as tabla, count(*) from public.roles
union all select 'permissions', count(*) from public.permissions
union all select 'role_permissions', count(*) from public.role_permissions
union all select 'programs', count(*) from public.programs
union all select 'course_mappings', count(*) from public.course_mappings
union all select 'profiles', count(*) from public.profiles
union all select 'profile_details', count(*) from public.profile_details
union all select 'user_roles', count(*) from public.user_roles
union all select 'user_programs', count(*) from public.user_programs
union all select 'enrollment_requests', count(*) from public.enrollment_requests
union all select 'audit_logs', count(*) from public.audit_logs
order by tabla;

-- Programas de prueba
select * from public.programs
where code in ('LIC-ISC-01','DIP-CIB-01','CERT-AWS-01','CUR-PY-01');

-- Cursos de Moodle de prueba
select * from public.course_mappings
where moodle_course_id in (101,102,103,104);

-- Usuarios de prueba
select * from public.profiles
where id in ('11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333');

-- Roles asignados a los usuarios de prueba
select ur.*, r.code as role_code, p.code as program_code
from public.user_roles ur
         join public.roles r on r.id = ur.role_id
         left join public.programs p on p.id = ur.program_id
where ur.user_id in ('11111111-1111-1111-1111-111111111111',
                     '22222222-2222-2222-2222-222222222222',
                     '33333333-3333-3333-3333-333333333333');

-- Inscripciones a programas
select up.*, pr.code as program_code, pr.name as program_name
from public.user_programs up
         join public.programs pr on pr.id = up.program_id
where up.user_id = '22222222-2222-2222-2222-222222222222';

-- Solicitudes de inscripción
select er.*, cm.moodle_shortname
from public.enrollment_requests er
         join public.course_mappings cm on cm.id = er.course_mapping_id
where er.user_id = '22222222-2222-2222-2222-222222222222';


select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

select * from profiles