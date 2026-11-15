BEGIN;

-- La oferta describe cursos activos; el acceso académico sigue requiriendo
-- matrícula propia autorizada/sincronizada y los guards de NestJS.
-- Mantiene JWT + RLS: no convertir el catálogo en una lectura service_role.
CREATE POLICY course_mappings_select_offer ON public.course_mappings
FOR SELECT TO authenticated
USING (
  is_active
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  AND EXISTS (
    SELECT 1 FROM public.profiles AS viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND viewer.status IN ('activo', 'pendiente')
  )
);

NOTIFY pgrst, 'reload schema';
COMMIT;
