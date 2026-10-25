-- =====================================================================
-- seed.sql · SOLO DEV. Datos de ejemplo (no va a staging/producción).
-- =====================================================================

-- Los dos cursos de ejemplo del PDF (sección 8.1) como programas del portal
insert into public.programs (code, slug, name, type, summary, duration_hours, is_published, sort_order) values
  ('ITI-101', 'introduccion-tecnologias-informacion',
   'Introducción a las Tecnologías de la Información', 'course',
   'Curso introductorio de ejemplo para validar roles, matrículas y actividades.', 40, true, 10),
  ('WEB-201', 'desarrollo-web-react',
   'Desarrollo Web con React', 'course',
   'Curso práctico de ejemplo para validar la integración portal-Moodle.', 60, true, 20)
on conflict (code) do nothing;

-- Cuando Moodle esté instalado y los cursos creados, enlaza su course_id real:
-- insert into public.course_mappings (program_id, moodle_course_id, moodle_shortname, moodle_fullname)
-- select id, 2, 'ITI-101', name from public.programs where code = 'ITI-101';
-- insert into public.course_mappings (program_id, moodle_course_id, moodle_shortname, moodle_fullname)
-- select id, 3, 'WEB-201', name from public.programs where code = 'WEB-201';
