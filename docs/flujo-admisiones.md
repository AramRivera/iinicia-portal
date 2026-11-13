# Admisiones y paso a estudiante

El aspirante puede consultar sus postulaciones desde Mi IINICIA. Administración consulta la bandeja general y coordinación consulta las postulaciones de sus programas asignados. El filtro del backend complementa RLS. Los roles sin atribuciones de revisión solo consultan sus propias postulaciones.

El dictamen requiere una cuenta revisora activa. Coordinación requiere permiso `admissions.review` y una asociación académica activa con el programa. El dictamen, la auditoría y, al admitir, la asignación del programa, la activación de un perfil pendiente y la concesión del rol Estudiante se confirman juntos. La admisión conserva roles adicionales y no crea una matrícula en Moodle. Un dictamen admitido requiere un proceso de baja para revertirse.

## Puesta en marcha

1. Revisar el esquema del ambiente de pruebas. La migración `20261113120000_admission_review.sql` requiere el esquema vigente con `admission_applications`, `roles.slug`, `user_roles.role_id` y las funciones de permisos. La migración inicial del repositorio por sí sola no contiene ese esquema.
2. Aplicar la migración en el ambiente autorizado antes de desplegar la API nueva. La función de dictamen requiere la credencial de servicio. Las escrituras de postulaciones y asociaciones a programas pasan por NestJS.
3. Validar con un aspirante, un administrador y un coordinador de otro programa. Comprobar postulación, bandeja, denegación fuera de ámbito, admisión y acceso al panel Estudiante.
4. Autorizar la matrícula del curso de prueba, confirmar el estado en Moodle e ingresar al aula con la cuenta de estudiante.

El contrato mantiene las rutas y las respuestas exitosas existentes. Para la interfaz, mostrar la carga y los fallos de bandeja por separado del estado vacío. Tras admitir, volver a consultar el perfil para actualizar los roles del usuario. El catálogo de solicitudes de materias y su relación con la admisión quedan como decisión de producto pendiente.

## Evidencia local del 13 de noviembre de 2026

Se levantaron PostgreSQL 16, Supabase Auth v2.197.0, PostgREST v14.6 y Mailpit en una red Docker de pruebas. Se usó el esquema histórico como base exclusiva del laboratorio y se aplicaron las migraciones de MFA y admisiones. Esta ejecución valida el flujo contra servicios locales con ese esquema de prueba. La línea base reproducible y la aplicación en el proyecto remoto siguen pendientes.

| Flujo | Resultado observado |
| --- | --- |
| Identidad | El registro creó un perfil Aspirante. Mailpit recibió el correo, se consumió el enlace y se completó TOTP. NestJS y PostgREST rechazaron AAL1. |
| Postulación | El aspirante se postuló a dos programas. Una segunda postulación al mismo programa devolvió 409. |
| Coordinación | Solo vio la postulación de su programa en NestJS y PostgREST. Pudo pasarla a revisión. El dictamen y la asignación fuera de su programa devolvieron 403. |
| Administración | Vio ambas postulaciones y admitió una. El perfil pasó a Activo, obtuvo el rol Estudiante y quedó asociado al programa. El dictamen quedó auditado. |
| Matrícula | La API sincronizó una matrícula en el Moodle local. El curso **HTML Básico Desde Cero** (ID 4) apareció en la consulta de cursos autorizados del estudiante. |
| Aula | Se consumió el enlace de SSO con un cliente HTTP. Moodle emitió una sesión y devolvió la página del curso. |

El curso contiene foro, recursos, página y tarea. Queda pendiente comprobar evaluación, calificación y finalización, y completar la demo desde navegador con un profesor y dos estudiantes. El registro se probó con Mailpit y TOTP. Turnstile requiere su propia validación.
