# Decisión Técnica: Política de Acceso a Supabase y Row Level Security (RLS)

**Proyecto:** IINICIA — Rediseño y Migración del Portal  
**Fecha:** Octubre 2026  
**Referencia:** `AGENTS.md` (Sección 21), `ALCANCE.md` (Secciones 4, 5.2, 9) y `IINICIA_DATABASE.sql`.

---

## 1. Contexto del Problema

El backend de IINICIA (desarrollado en NestJS) actúa como la capa intermedia entre la aplicación cliente (Next.js/React), el motor de base de datos e identidad (Supabase PostgreSQL + Auth) y el sistema de gestión de aprendizaje (Moodle LMS).

La base de datos PostgreSQL cuenta con políticas de seguridad a nivel de fila (**Row Level Security - RLS**) habilitadas en todas sus tablas de datos (`profiles`, `roles`, `user_roles`, `programs`, `course_mappings`, `enrollment_requests`, `audit_logs`, etc.).

Es indispensable establecer formalmente la estrategia de acceso desde el backend hacia Supabase para evitar vulnerabilidades de seguridad, elevación no autorizada de privilegios o bypass indebido de políticas RLS.

---

## 2. Comparativa de Modelos de Acceso

| Criterio | Modelo A: Acceso Exclusivo con JWT de Usuario (RLS Puro) | Modelo B: Acceso Privilegiado Exclusivo (Service Role Key) | Modelo C: **Modelo Mixto Controlado (Recomendado)** |
|---|---|---|---|
| **Mecanismo** | Todas las consultas a PostgREST / Supabase se ejecutan inyectando el Bearer Token (JWT) del usuario conectado. | El backend utiliza permanentemente la `SUPABASE_SECRET_KEY` (Service Role) omitiendo RLS en PostgreSQL. | Las operaciones del usuario final usan el JWT autenticado; las tareas administrativas del sistema y sincronización usan Service Role con validación explícita en NestJS. |
| **Protección RLS** | Máxima a nivel de base de datos: PostgreSQL filtra y restringe filas según `auth.uid()`. | Nula a nivel de base de datos: el backend asume el 100% de la responsabilidad de filtrado. | Activa en operaciones de usuario; desactivada solo en operaciones de fondo explícitas donde PostgreSQL no tiene contexto de sesión. |
| **Operaciones del Sistema / Moodle Sync** | Inviable: Webhooks, tareas asíncronas o sincronizaciones con Moodle no cuentan con sesión interactiva del usuario. | Viable pero con alto riesgo si se omite un filtro `WHERE user_id = ...`. | Óptimo: El backend ejecuta la sincronización con Moodle y actualiza el estado de las tablas mediante el cliente privilegiado validado. |
| **Riesgo de Fuga de Credenciales** | Bajo en el backend. | Crítico si la Service Role Key se expone accidentalmente. | Seguro: La Service Role Key está aislada en variables de entorno del servidor y nunca se expone al cliente. |

---

## 3. Decisión Adoptada: Modelo Mixto Controlado

Se adopta el **Modelo Mixto Controlado** bajo las siguientes directrices arquitectónicas:

### 3.1. Cliente de Usuario (User-Scoped Client con JWT)
1. **Ámbito de aplicación:**
   - Consulta de perfil propio (`/auth/me`, `/users/me/profile`).
   - Consulta de cursos autorizados para el estudiante o profesor (`/courses`, `/enrollments/me`).
   - Envío de solicitudes de inscripción o admisión.
2. **Comportamiento:**
   - El cliente de Supabase se instancia o configura con el `accessToken` verificado del usuario.
   - Las políticas RLS de PostgreSQL definidas en `IINICIA_DATABASE.sql` (`USING (id = auth.uid())`, `course_mappings_select_authorized`, etc.) evalúan la consulta directamente.
   - Si un usuario manipula identificadores en las peticiones, PostgreSQL bloquea el acceso o devuelve un conjunto vacío.

### 3.2. Cliente Privilegiado del Servidor (Admin / Service Role Client)
1. **Ámbito de aplicación:**
   - Sincronización bidireccional con Moodle LMS (`MoodleService` y `EnrollmentSyncService`).
   - Registro de eventos en la bitácora de auditoría (`audit_logs`) tras operaciones administrativas.
   - Aprobación/rechazo administrativo de inscripciones y asignación de roles mediante endpoints del panel de control.
   - Tareas en segundo plano o inicialización de cuentas tras verificación de Supabase Auth.
2. **Reglas de Seguridad Estrictas:**
   - **Autorización previa en NestJS:** Ninguna llamada al cliente administrativo se ejecuta sin antes pasar por `SupabaseAuthGuard` y `RolesGuard` / `PermissionsGuard` (validando roles como `superadministrador`, `administrador` o permisos como `enrollments.authorize`, `moodle.sync.execute`).
   - **Aislamiento de la clave:** La `SUPABASE_SECRET_KEY` solo reside en variables de entorno del backend (`apps/api/.env`), nunca en variables `NEXT_PUBLIC_*`, ni en respuestas JSON, ni en logs.
   - **No asumir RLS pasivo:** Al utilizar el cliente privilegiado, el código del repositorio en NestJS **debe filtrar y validar explícitamente** las entidades afectadas (`eq('id', targetId)`).

---

## 4. Impacto sobre la Base de Datos y Privilegios
- La base de datos mantiene RLS activo en el 100% de las tablas públicas.
- Las funciones `has_role`, `has_any_role`, `has_permission`, `is_admin` se definen con `SECURITY DEFINER` y `SET search_path = public` para evaluar permisos sin caer en recursión infinita en las políticas RLS.
- Las vistas `v_user_complete_profile` y `v_user_authorized_courses` se crearon con `security_invoker = true` para que respeten estrictamente la identidad y roles de quien consulta.
