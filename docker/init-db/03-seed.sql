-- IINICIA Portal · despliegue local · 03-seed.sql
-- =================================================================================
-- PROYECTO: PORTAL IINICIA
-- SEMILLAS REPRODUCIBLES DE LINEA BASE (ROLES, PERMISOS, CATALOGOS)
-- =================================================================================

BEGIN;

-- 1. ROLES DEL SISTEMA
INSERT INTO public.roles (id, slug, name, description, hierarchy_level, default_moodle_archetype, is_system) VALUES
(1, 'superadministrador', 'Superadministrador', 'Configuración global, usuarios, roles, integraciones, parámetros y auditoría.', 100, 'manager', true),
(2, 'administrador', 'Administrador', 'Gestión de usuarios, estados, programas, autorizaciones e inscripciones.', 90, 'manager', true),
(3, 'coordinador', 'Coordinador', 'Consulta y gestión de usuarios/programas bajo su ámbito.', 70, 'coursecreator', true),
(4, 'profesor', 'Profesor', 'Perfil docente, consulta de cursos asignados y acceso al campus.', 50, 'editingteacher', true),
(5, 'estudiante', 'Estudiante', 'Perfil, programa, cursos asignados y acceso al campus.', 30, 'student', true),
(6, 'soporte', 'Soporte', 'Atención operativa limitada y consulta controlada.', 20, NULL, true),
(7, 'aspirante', 'Aspirante', 'Registro, actualización de datos y seguimiento de admisión. Sin acceso a cursos hasta ser autorizado.', 10, NULL, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  default_moodle_archetype = EXCLUDED.default_moodle_archetype,
  is_system = EXCLUDED.is_system;

SELECT setval('public.roles_id_seq', (SELECT max(id) FROM public.roles));

-- 2. PERMISOS DEL SISTEMA
INSERT INTO public.permissions (id, code, module, description) VALUES
(1, 'system.settings.manage', 'system', 'Configuración global y parámetros de la plataforma'),
(2, 'audit.logs.read', 'audit', 'Consulta de bitácora y trazabilidad de eventos'),
(3, 'users.read', 'users', 'Lectura de perfiles de usuario y directorios'),
(4, 'users.manage', 'users', 'Crear, suspender y editar perfiles de usuarios'),
(5, 'roles.assign', 'roles', 'Asignar o revocar roles de usuarios'),
(6, 'programs.manage', 'programs', 'Crear y editar programas académicos'),
(7, 'courses.manage', 'courses', 'Configurar mapeo de cursos con Moodle'),
(8, 'enrollments.authorize', 'enrollments', 'Autorizar matrículas y asignaciones docentes'),
(9, 'moodle.sync.execute', 'moodle', 'Ejecutar sincronización de usuarios y matrículas con Moodle'),
(10, 'campus.access', 'campus', 'Acceso al campus virtual y cursos asignados'),
(11, 'cms.manage', 'cms', 'Gestión de contenidos, avisos y noticias'),
(12, 'admissions.review', 'admissions', 'Dictaminar solicitudes de admisión académica')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

SELECT setval('public.permissions_id_seq', (SELECT max(id) FROM public.permissions));

-- 3. MATRIZ DE PERMISOS POR ROL
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
-- Superadministrador (todos)
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12),
-- Administrador
(2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11), (2, 12),
-- Coordinador
(3, 3), (3, 8), (3, 10), (3, 12),
-- Profesor
(4, 10),
-- Estudiante
(5, 10),
-- Soporte
(6, 3)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. CONFIGURACIONES GENERALES DEL SISTEMA
INSERT INTO public.system_settings (key, value, description, is_public) VALUES
('portal.general', '{"institution_name":"IINICIA","support_email":"contacto@iinicia.org","admissions_open":true}'::jsonb, 'Configuración pública general del portal', true),
('moodle.integration', '{"sync_enabled":true,"auto_create_user_on_role_assign":true,"default_auth_method":"manual"}'::jsonb, 'Parámetros de sincronización con Moodle LMS', false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public;

-- 5. PROGRAMAS ACADEMICOS
INSERT INTO public.programs (id, code, slug, name, short_description, description, type, modality, duration_text, duration_hours, is_featured, is_active, display_order) VALUES
('a87fa37d-73ed-4bf8-9fe9-bee188968642', 'PROG-TI-001', 'introduccion-a-las-tecnologias-de-la-informacion', 'Introducción a las Tecnologías de la Información', 'Fundamentos esenciales de infraestructura digital, redes, software y herramientas tecnológicas.', 'Programa formativo diseñado para desarrollar competencias sólidas en tecnologías de la información, arquitectura de cómputo, sistemas operativos y entornos colaborativos.', 'curso', 'en_linea', '4 semanas', 40, true, true, 1),
('c12a3e60-c65d-4720-9737-07008b3e7f1e', 'PROG-WEB-002', 'desarrollo-web-con-react', 'Desarrollo Web con React', 'Construcción de interfaces modernas, componentes reutilizables, hooks y arquitecturas frontend con React y Next.js.', 'Curso práctico orientado al desarrollo de aplicaciones web de alto rendimiento utilizando React, TypeScript, manejo de estado e integración segura con APIs REST.', 'curso', 'en_linea', '6 semanas', 60, true, true, 2),
('6a7a5d42-97e8-4737-8071-f93cc88227d4', 'HTML-BASICO', 'html-basico', 'HTML Básico Desde Cero', 'Curso integral de fundamentos de la web y estructura semántica.', 'En este curso aprenderás HTML, el lenguaje fundamental con el que se construyen las estructuras de todas las páginas web en Internet.', 'certificacion', 'en_linea', '1 dia', 40, false, true, 0)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  modality = EXCLUDED.modality,
  duration_text = EXCLUDED.duration_text,
  duration_hours = EXCLUDED.duration_hours,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- 6. MAPEOS DE CURSOS CON MOODLE
INSERT INTO public.course_mappings (id, program_id, portal_course_code, slug, course_name, course_description, term_or_module, is_mandatory, moodle_course_id, moodle_shortname, moodle_course_url, is_active) VALUES
('1617d4b7-920d-439b-aa16-bb8d2e7516b7', 'c12a3e60-c65d-4720-9737-07008b3e7f1e', 'CUR-MOO-002', 'curso-2-desarrollo-web-con-react', 'Curso 2. Desarrollo Web con React', 'Incluye unidades o temas, recurso, actividad práctica, foro, cuestionario o evaluación, calificación y finalización de curso.', 1, true, 2, 'IINICIA-REACT-102', 'http://localhost/moodle/course/view.php?id=2', true),
('671820a5-88fc-4158-a3e8-c2d2dfcc9ffb', 'a87fa37d-73ed-4bf8-9fe9-bee188968642', 'CUR-MOO-001', 'curso-1-introduccion-a-las-tecnologias-de-la-informacion', 'Curso 1. Introducción a las Tecnologías de la Información', 'Incluye presentación del curso, recurso PDF o página, foro, tarea, cuestionario, calificación y finalización de actividad.', 1, true, 3, 'IINICIA-TI-101', 'http://localhost/moodle/course/view.php?id=3', true),
('d67c94c9-9132-4d45-8973-38d18b56307b', '6a7a5d42-97e8-4737-8071-f93cc88227d4', '005', 'html-basico-desde-cero-4', 'HTML Básico Desde Cero', 'Bienvenida e Introducción al Curso (Bloque General). En este curso aprenderás HTML, el lenguaje fundamental con el que se construyen las estructuras de todas las páginas web en Internet.', 1, true, 4, 'html-basico', 'http://192.168.191.171/moodle/course/view.php?id=4', true)
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  portal_course_code = EXCLUDED.portal_course_code,
  slug = EXCLUDED.slug,
  course_name = EXCLUDED.course_name,
  course_description = EXCLUDED.course_description,
  term_or_module = EXCLUDED.term_or_module,
  is_mandatory = EXCLUDED.is_mandatory,
  moodle_course_id = EXCLUDED.moodle_course_id,
  moodle_shortname = EXCLUDED.moodle_shortname,
  moodle_course_url = EXCLUDED.moodle_course_url,
  is_active = EXCLUDED.is_active;

-- 7. INVENTARIO DE MIGRACION DESDE WORDPRESS Y REDIRECCIONES 301 (CA-01, CA-02)
INSERT INTO public.wp_migration_inventory (
  legacy_url,
  legacy_title,
  asset_type,
  action,
  new_target_url,
  http_redirect_code,
  is_redirect_active,
  migration_completed,
  seo_notes
) VALUES
  ('/?page_id=1172', 'Universidad IINICIA', 'page', 'MIGRAR', '/universidad', 301, true, true, 'Página institucional migrada a ruta estática Next.js /universidad'),
  ('/?page_id=1202', 'Cursos IINICIA', 'page', 'MIGRAR', '/cursos', 301, true, true, 'Catálogo de cursos migrado a /cursos'),
  ('/?page_id=1652', 'Certificaciones IINICIA', 'page', 'MIGRAR', '/certificaciones', 301, true, true, 'Oferta de certificaciones migrada a /certificaciones'),
  ('/?page_id=1653', 'Diplomados IINICIA', 'page', 'MIGRAR', '/diplomados', 301, true, true, 'Oferta de diplomados migrada a /diplomados'),
  ('/?page_id=16', 'Regístrate', 'page', 'MIGRAR', '/registro', 301, true, true, 'Formulario legado sustituido por registro Supabase Auth con CAPTCHA en /registro'),
  ('/?page_id=2179', 'Iniciar sesión', 'page', 'MIGRAR', '/login', 301, true, true, 'Acceso al campus redirigido a login seguro con TOTP en /login'),
  ('/contacto/', 'Contacto Institucional', 'page', 'MIGRAR', '/contacto', 301, true, true, 'Formulario institucional de contacto migrado a /contacto'),
  ('/admisiones/', 'Admisiones', 'page', 'MIGRAR', '/admisiones', 301, true, true, 'Convocatoria y postulación de aspirantes migrada a /admisiones'),
  ('/?page_id=15', 'Recuperar Contraseña', 'page', 'MIGRAR', '/recuperar-password', 301, true, true, 'Flujo legado de recuperación sustituido por PKCE en /recuperar-password'),
  ('/wp-login.php', 'WordPress Login', 'system', 'MIGRAR', '/login', 301, true, true, 'Ruta de autenticación WP redirigida a /login para prevenir accesos huérfanos'),
  ('/wp-admin/', 'WordPress Admin', 'system', 'MIGRAR', '/login', 301, true, true, 'Panel administrativo WP redirigido a /login'),
  ('/', 'Página Principal IINICIA', 'page', 'MIGRAR', '/', 301, false, true, 'Portada sustituida por landing page Next.js en / (sin redirección activa para evitar bucles)')
ON CONFLICT (legacy_url) DO UPDATE SET
  legacy_title = EXCLUDED.legacy_title,
  asset_type = EXCLUDED.asset_type,
  action = EXCLUDED.action,
  new_target_url = EXCLUDED.new_target_url,
  http_redirect_code = EXCLUDED.http_redirect_code,
  is_redirect_active = EXCLUDED.is_redirect_active,
  migration_completed = EXCLUDED.migration_completed,
  seo_notes = EXCLUDED.seo_notes,
  updated_at = now();

COMMIT;
