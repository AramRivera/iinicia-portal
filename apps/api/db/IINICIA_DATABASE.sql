-- =================================================================================
-- PROYECTO: REDISEÑO Y MIGRACIÓN DEL PORTAL IINICIA (VERSIÓN DEFINITIVA PRODUCCIÓN)
-- ARQUITECTURA: Next.js + NestJS + Supabase (PostgreSQL 15+) + Moodle LMS
-- BASE DE DATOS OFICIAL: IINICIA_DATABASE
-- =================================================================================

BEGIN;

-- =================================================================================
-- 1. EXTENSIONES
-- =================================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas rápidas por texto en panel admin

-- =================================================================================
-- 2. TIPOS ENUMERADOS (DOMINIOS DE CONTROL)
-- =================================================================================
DO $$ BEGIN
    CREATE TYPE public.user_status AS ENUM ('pendiente', 'activo', 'suspendido', 'inactivo', 'baja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.program_type AS ENUM ('licenciatura', 'maestria', 'diplomado', 'certificacion', 'curso', 'taller', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.program_modality AS ENUM ('en_linea', 'presencial', 'hibrido', 'autogestivo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.academic_status AS ENUM ('postulado', 'en_revision', 'admitido', 'rechazado', 'inscrito', 'cursando', 'egresado', 'baja', 'suspendido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.enrollment_status AS ENUM ('pendiente', 'autorizada', 'rechazada', 'sincronizada', 'error_sincronizacion', 'desmatriculada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.moodle_role_type AS ENUM ('student', 'editingteacher', 'teacher', 'manager', 'coursecreator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.sync_status_type AS ENUM ('no_vinculado', 'pendiente', 'sincronizado', 'error', 'suspendido_en_moodle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.cms_content_type AS ENUM ('pagina', 'noticia', 'aviso', 'evento', 'faq', 'documento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.cms_content_status AS ENUM ('borrador', 'publicado', 'archivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.wp_migration_action AS ENUM ('MIGRAR', 'ACTUALIZAR', 'REESCRIBIR', 'ELIMINAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.contact_message_status AS ENUM ('nuevo', 'en_atencion', 'resuelto', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =================================================================================
-- 3. IDENTIDAD, PERFILES Y RBAC (SECCIONES 5.1 Y 6)
-- =================================================================================

-- 3.1 Tabla: profiles (Relación 1:1 con auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    curp_or_id TEXT UNIQUE,
    matricula TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    status public.user_status NOT NULL DEFAULT 'pendiente',
    
    -- Campos de integración con Moodle (Nunca expuestos para edición directa del cliente)
    moodle_user_id BIGINT UNIQUE,
    moodle_username TEXT UNIQUE,
    moodle_sync_status public.sync_status_type NOT NULL DEFAULT 'no_vinculado',
    moodle_last_sync_at TIMESTAMPTZ,
    moodle_sync_error TEXT,
    
    -- Trazabilidad y metadatos
    last_login_at TIMESTAMPTZ,
    terms_accepted_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfil institucional del usuario, estado administrativo y vínculo con Moodle.';

-- 3.2 Tabla: roles (Catálogo oficial de roles de la plataforma)
CREATE TABLE IF NOT EXISTS public.roles (
    id SMALLSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    hierarchy_level SMALLINT NOT NULL DEFAULT 10, -- Mayor número = mayor jerarquía (100=superadmin, 10=aspirante)
    default_moodle_archetype public.moodle_role_type,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.roles IS 'Catálogo de roles del portal (RBAC).';

-- 3.3 Tabla: permissions (Permisos granulares del sistema)
CREATE TABLE IF NOT EXISTS public.permissions (
    id SMALLSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- ej: users.read, users.write, moodle.sync, courses.enroll, cms.manage
    module TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.permissions IS 'Catálogo de permisos granulares por módulo para validación en Backend y RLS.';

-- 3.4 Tabla: role_permissions (Matriz Rol <-> Permiso)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id SMALLINT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id SMALLINT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Asignación de permisos específicos a cada rol.';

-- 3.5 Tabla: user_roles (Relación Usuario <-> Rol, permite múltiples roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ, -- Opcional: para roles temporales o suplencias
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Relación usuario-rol con soporte para múltiples roles activos.';

-- =================================================================================
-- 4. OFERTA ACADÉMICA, PROGRAMAS Y CURSOS MOODLE (SECCIONES 5.1, 8 Y 9)
-- =================================================================================

-- 4.1 Tabla: programs (Licenciaturas, diplomados, certificaciones, cursos)
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_description TEXT,
    description TEXT,
    type public.program_type NOT NULL DEFAULT 'curso',
    modality public.program_modality NOT NULL DEFAULT 'en_linea',
    duration_text TEXT, -- ej: "4 cuatrimestres" o "60 horas"
    duration_hours INTEGER,
    credits INTEGER,
    banner_url TEXT,
    thumbnail_url TEXT,
    syllabus_pdf_url TEXT,
    admission_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    graduate_profile TEXT,
    moodle_category_id BIGINT, -- Categoría asociada en Moodle
    coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.programs IS 'Catálogo de programas académicos mostrados en Oferta Académica y vinculados a usuarios.';

-- 4.2 Tabla: user_programs (Relación de usuarios con programas y estatus académico)
CREATE TABLE IF NOT EXISTS public.user_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    status public.academic_status NOT NULL DEFAULT 'postulado',
    cohort TEXT, -- Generación o ciclo escolar (ej: "2026-B")
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, program_id)
);

COMMENT ON TABLE public.user_programs IS 'Trayectoria académica del usuario dentro de un programa.';

-- 4.3 Tabla: course_mappings (Vínculo entre asignaturas/cursos del portal y course_id de Moodle)
CREATE TABLE IF NOT EXISTS public.course_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    portal_course_code TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    course_name TEXT NOT NULL,
    course_description TEXT,
    thumbnail_url TEXT,
    term_or_module SMALLINT DEFAULT 1, -- Módulo, bloque o semestre dentro del programa
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Identificadores en Moodle LMS
    moodle_course_id BIGINT UNIQUE NOT NULL,
    moodle_shortname TEXT UNIQUE NOT NULL,
    moodle_category_id BIGINT,
    moodle_course_url TEXT,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.course_mappings IS 'Mapeo exacto entre cursos del portal y el course_id dentro de Moodle.';

-- 4.4 Tabla: enrollment_requests (Solicitudes, autorizaciones y matrículas en cursos de Moodle)
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_mapping_id UUID NOT NULL REFERENCES public.course_mappings(id) ON DELETE RESTRICT,
    program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    moodle_role public.moodle_role_type NOT NULL DEFAULT 'student',
    status public.enrollment_status NOT NULL DEFAULT 'pendiente',
    
    -- Trazabilidad de autorización administrativa
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    authorized_at TIMESTAMPTZ,
    
    -- Estado de sincronización y datos informativos cacheados desde Moodle (solo lectura en portal)
    moodle_enrol_id BIGINT,
    synced_to_moodle_at TIMESTAMPTZ,
    sync_attempts SMALLINT NOT NULL DEFAULT 0,
    sync_error_message TEXT,
    cached_progress NUMERIC(5,2) DEFAULT 0.00,
    cached_final_grade NUMERIC(6,2),
    cached_completed BOOLEAN DEFAULT FALSE,
    last_moodle_access_at TIMESTAMPTZ,
    
    access_start_at TIMESTAMPTZ,
    access_end_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, course_mapping_id)
);

COMMENT ON TABLE public.enrollment_requests IS 'Control de matrículas (estudiantes y docentes) y estado de sincronización con Moodle.';

-- 4.5 Tabla: campus_access_logs (Trazabilidad de SSO y saltos del Portal hacia Moodle)
CREATE TABLE IF NOT EXISTS public.campus_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_mapping_id UUID REFERENCES public.course_mappings(id) ON DELETE SET NULL,
    moodle_course_id BIGINT,
    access_method TEXT NOT NULL DEFAULT 'sso_backend_redirect',
    ip_address TEXT,
    user_agent TEXT,
    succeeded BOOLEAN NOT NULL DEFAULT TRUE,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.campus_access_logs IS 'Registro de accesos desde Mi IINICIA hacia el Campus Moodle (Sección 11).';

-- =================================================================================
-- 5. ADMISIONES, CONTENIDOS INSTITUCIONALES Y MIGRACIÓN WORDPRESS (SECCIONES 9 Y 12)
-- =================================================================================

-- 5.1 Tabla: admission_applications (Flujo de admisión para Aspirantes)
CREATE TABLE IF NOT EXISTS public.admission_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    status public.academic_status NOT NULL DEFAULT 'postulado',
    previous_education_level TEXT,
    previous_institution TEXT,
    average_grade NUMERIC(4,2),
    motivation_letter TEXT,
    documents_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- URLs de documentos en Supabase Storage
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (applicant_id, program_id)
);

COMMENT ON TABLE public.admission_applications IS 'Solicitudes de admisión y seguimiento de aspirantes.';

-- 5.2 Tabla: institutional_directory (Sección Universidad: Autoridades y Docentes destacados)
CREATE TABLE IF NOT EXISTS public.institutional_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    title_or_position TEXT NOT NULL, -- ej: "Rector", "Director Académico", "Docente de Ingeniería"
    department TEXT,
    category TEXT NOT NULL DEFAULT 'autoridad', -- 'autoridad', 'docente', 'consejo'
    bio TEXT,
    photo_url TEXT,
    email_contact TEXT,
    linkedin_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.institutional_directory IS 'Directorio público de autoridades universitarias y cuerpo docente (Sección 9.1).';

-- 5.3 Tabla: cms_contents (Noticias, avisos y páginas institucionales migradas de WordPress)
CREATE TABLE IF NOT EXISTS public.cms_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    body_content TEXT NOT NULL, --Soporta Markdown, MDX o HTML sanitizado
    content_type public.cms_content_type NOT NULL DEFAULT 'noticia',
    status public.cms_content_status NOT NULL DEFAULT 'borrador',
    featured_image_url TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    seo_title TEXT,
    seo_description TEXT,
    legacy_wp_id BIGINT,
    legacy_wp_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cms_contents IS 'Repositorio de noticias, páginas estáticas (Misión, Visión, Modelo Educativo) y avisos.';

-- 5.4 Tabla: contact_messages (Formulario de la sección /contacto)
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL,
    program_of_interest UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status public.contact_message_status NOT NULL DEFAULT 'nuevo',
    attended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    internal_notes TEXT,
    ip_address TEXT,
    attended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.contact_messages IS 'Mensajes recibidos desde el formulario público de contacto.';

-- 5.5 Tabla: wp_migration_inventory (Inventario de migración desde WordPress y redirecciones 301 - Sección 12)
CREATE TABLE IF NOT EXISTS public.wp_migration_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_url TEXT UNIQUE NOT NULL, -- ej: "/oferta-educativa/diplomado-antiguo/"
    legacy_title TEXT,
    asset_type TEXT NOT NULL DEFAULT 'page', -- 'page', 'post', 'media', 'form', 'category'
    action public.wp_migration_action NOT NULL DEFAULT 'MIGRAR',
    new_target_url TEXT, -- ej: "/oferta-academica/desarrollo-web-con-react"
    http_redirect_code SMALLINT DEFAULT 301 CHECK (http_redirect_code IN (301, 302, 307, 308, 410)),
    is_redirect_active BOOLEAN NOT NULL DEFAULT TRUE,
    migration_completed BOOLEAN NOT NULL DEFAULT FALSE,
    seo_notes TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.wp_migration_inventory IS 'Inventario auditable de migración desde WordPress y mapa de redirecciones 301 (Secciones 12 y 18).';

-- =================================================================================
-- 6. AUDITORÍA Y CONFIGURACIÓN DEL SISTEMA (SECCIONES 5.1, 10 Y 14)
-- =================================================================================

-- 6.1 Tabla: audit_logs (Bitácora de operaciones administrativas y eventos de seguridad)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Bitácora inmutable de acciones administrativas, cambios de rol, estados y sincronizaciones.';

-- 6.2 Tabla: system_settings (Parámetros globales configurables por Superadministrador)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.system_settings IS 'Parámetros globales de configuración del portal e integración con Moodle.';

-- =================================================================================
-- 7. ÍNDICES DE RENDIMIENTO Y BÚSQUEDA
-- =================================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_moodle_user_id ON public.profiles(moodle_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_moodle_sync_status ON public.profiles(moodle_sync_status);
CREATE INDEX IF NOT EXISTS idx_profiles_search_trgm ON public.profiles USING gin ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON public.user_roles(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_programs_slug_active ON public.programs(slug) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_programs_type ON public.programs(type);

CREATE INDEX IF NOT EXISTS idx_user_programs_user ON public.user_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_program ON public.user_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_status ON public.user_programs(status);

CREATE INDEX IF NOT EXISTS idx_course_mappings_program ON public.course_mappings(program_id);
CREATE INDEX IF NOT EXISTS idx_course_mappings_moodle_id ON public.course_mappings(moodle_course_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_user_status ON public.enrollment_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_course ON public.enrollment_requests(course_mapping_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_moodle_role ON public.enrollment_requests(moodle_role);

CREATE INDEX IF NOT EXISTS idx_cms_contents_slug_status ON public.cms_contents(slug, status);
CREATE INDEX IF NOT EXISTS idx_wp_migration_legacy_url ON public.wp_migration_inventory(legacy_url) WHERE is_redirect_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created ON public.audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- =================================================================================
-- 8. FUNCIONES DE SEGURIDAD Y RBAC (SECURITY DEFINER SIN RECURSIÓN RLS)
-- =================================================================================

-- 8.1 Verifica si el usuario tiene un rol activo específico
CREATE OR REPLACE FUNCTION public.has_role(required_role_slug TEXT, target_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = target_uid
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND r.slug = required_role_slug
    );
$$;

-- 8.2 Verifica si el usuario tiene cualquiera de los roles listados
CREATE OR REPLACE FUNCTION public.has_any_role(required_role_slugs TEXT[], target_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = target_uid
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND r.slug = ANY(required_role_slugs)
    );
$$;

-- 8.3 Verifica si el usuario tiene un permiso granular activo a través de cualquiera de sus roles
CREATE OR REPLACE FUNCTION public.has_permission(required_permission_code TEXT, target_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = target_uid
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND p.code = required_permission_code
    );
$$;

-- 8.4 Helper rápido para Administradores (Superadministrador o Administrador)
CREATE OR REPLACE FUNCTION public.is_admin(target_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT public.has_any_role(ARRAY['superadministrador', 'administrador'], target_uid);
$$;

-- 8.5 Devuelve el arreglo de slugs de roles activos del usuario autenticado (útil para Frontend/Backend)
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(ARRAY_AGG(r.slug ORDER BY r.hierarchy_level DESC), ARRAY[]::TEXT[])
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
$$;

-- =================================================================================
-- 9. TRIGGERS DE AUTOMATIZACIÓN, TIMESTAMPS Y AUDITORÍA (CA-19)
-- =================================================================================

-- 9.1 Actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles', 'user_roles', 'programs', 'user_programs',
        'course_mappings', 'enrollment_requests', 'admission_applications',
        'institutional_directory', 'cms_contents', 'contact_messages',
        'wp_migration_inventory', 'system_settings'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
    END LOOP;
END $$;

-- 9.2 Trigger de Registro en Supabase Auth -> Crea Perfil + Rol 'aspirante' + Bitácora (Sección 7.1)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_aspirante_role_id SMALLINT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_phone TEXT;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'nombre', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'apellidos', '');
    v_phone      := NEW.raw_user_meta_data->>'phone';

    INSERT INTO public.profiles (id, email, first_name, last_name, phone, status)
    VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_phone, 'pendiente')
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO v_aspirante_role_id FROM public.roles WHERE slug = 'aspirante' LIMIT 1;

    IF v_aspirante_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id, is_active)
        VALUES (NEW.id, v_aspirante_role_id, TRUE)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, new_values)
    VALUES (
        NEW.id,
        NEW.id,
        'USER_REGISTERED',
        'profiles',
        NEW.id::TEXT,
        jsonb_build_object('email', NEW.email, 'initial_role', 'aspirante', 'status', 'pendiente')
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 9.3 Trigger de Auditoría: Cambios en profiles (estado o vinculación Moodle)
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.moodle_user_id IS DISTINCT FROM NEW.moodle_user_id)
       OR (OLD.moodle_sync_status IS DISTINCT FROM NEW.moodle_sync_status) THEN
        INSERT INTO public.audit_logs (
            actor_id, target_user_id, action, entity_name, entity_id, old_values, new_values
        ) VALUES (
            COALESCE(auth.uid(), NEW.id),
            NEW.id,
            CASE
                WHEN OLD.moodle_user_id IS DISTINCT FROM NEW.moodle_user_id THEN 'MOODLE_USER_LINKED'
                WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'USER_STATUS_CHANGED'
                ELSE 'MOODLE_SYNC_STATUS_UPDATED'
            END,
            'profiles',
            NEW.id::TEXT,
            jsonb_build_object('status', OLD.status, 'moodle_user_id', OLD.moodle_user_id, 'moodle_sync_status', OLD.moodle_sync_status),
            jsonb_build_object('status', NEW.status, 'moodle_user_id', NEW.moodle_user_id, 'moodle_sync_status', NEW.moodle_sync_status)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_changes ON public.profiles;
CREATE TRIGGER trg_audit_profile_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

-- 9.4 Trigger de Auditoría: Asignación, cambio o retiro de roles en user_roles
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_slug TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT slug INTO v_role_slug FROM public.roles WHERE id = NEW.role_id;
        INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, new_values)
        VALUES (COALESCE(auth.uid(), NEW.assigned_by), NEW.user_id, 'ROLE_ASSIGNED', 'user_roles', NEW.id::TEXT,
                jsonb_build_object('role', v_role_slug, 'is_active', NEW.is_active));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT slug INTO v_role_slug FROM public.roles WHERE id = NEW.role_id;
        INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, old_values, new_values)
        VALUES (auth.uid(), NEW.user_id, 'ROLE_UPDATED', 'user_roles', NEW.id::TEXT,
                jsonb_build_object('role', v_role_slug, 'is_active', OLD.is_active),
                jsonb_build_object('role', v_role_slug, 'is_active', NEW.is_active));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT slug INTO v_role_slug FROM public.roles WHERE id = OLD.role_id;
        INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, old_values)
        VALUES (auth.uid(), OLD.user_id, 'ROLE_REMOVED', 'user_roles', OLD.id::TEXT,
                jsonb_build_object('role', v_role_slug));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();

-- 9.5 Trigger de Auditoría: Cambios en user_programs y enrollment_requests
CREATE OR REPLACE FUNCTION public.audit_academic_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, new_values)
        VALUES (COALESCE(auth.uid(), NEW.authorized_by), NEW.user_id, TG_TABLE_NAME || '_CREATED', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.audit_logs (actor_id, target_user_id, action, entity_name, entity_id, old_values, new_values)
        VALUES (COALESCE(auth.uid(), NEW.authorized_by), NEW.user_id, TG_TABLE_NAME || '_STATUS_CHANGED', TG_TABLE_NAME, NEW.id::TEXT,
                jsonb_build_object('status', OLD.status),
                jsonb_build_object('status', NEW.status));
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_programs ON public.user_programs;
CREATE TRIGGER trg_audit_user_programs
AFTER INSERT OR UPDATE ON public.user_programs
FOR EACH ROW EXECUTE FUNCTION public.audit_academic_changes();

DROP TRIGGER IF EXISTS trg_audit_enrollment_requests ON public.enrollment_requests;
CREATE TRIGGER trg_audit_enrollment_requests
AFTER INSERT OR UPDATE ON public.enrollment_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_academic_changes();

-- =================================================================================
-- 10. SEGURIDAD: ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS (SECCIÓN 5.2 Y CA-06)
-- =================================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_migration_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Limpieza previa de políticas para garantizar idempotencia
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 10.1 Políticas: profiles
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles
FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
);

CREATE POLICY "profiles_update_own_safe" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
    AND moodle_user_id IS NOT DISTINCT FROM (SELECT p.moodle_user_id FROM public.profiles p WHERE p.id = auth.uid())
    AND moodle_sync_status = (SELECT p.moodle_sync_status FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10.2 Políticas: roles, permissions y role_permissions
CREATE POLICY "roles_select_authenticated" ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "roles_superadmin_manage" ON public.roles FOR ALL TO authenticated
USING (public.has_role('superadministrador')) WITH CHECK (public.has_role('superadministrador'));

CREATE POLICY "permissions_select_authenticated" ON public.permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "permissions_superadmin_manage" ON public.permissions FOR ALL TO authenticated
USING (public.has_role('superadministrador')) WITH CHECK (public.has_role('superadministrador'));

CREATE POLICY "role_permissions_select_authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_permissions_superadmin_manage" ON public.role_permissions FOR ALL TO authenticated
USING (public.has_role('superadministrador')) WITH CHECK (public.has_role('superadministrador'));

-- 10.3 Políticas: user_roles
CREATE POLICY "user_roles_select_own_or_staff" ON public.user_roles
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
);

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10.4 Políticas: programs (Oferta académica visible públicamente si está activa)
CREATE POLICY "programs_select_public" ON public.programs
FOR SELECT TO anon, authenticated
USING (
    is_active = TRUE
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador'])
);

CREATE POLICY "programs_admin_manage" ON public.programs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10.5 Políticas: user_programs
CREATE POLICY "user_programs_select_own_or_staff" ON public.user_programs
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
);

CREATE POLICY "user_programs_manage_staff" ON public.user_programs
FOR ALL TO authenticated
USING (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador']))
WITH CHECK (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador']));

-- 10.6 Políticas: course_mappings (Estudiante/Profesor solo ve cursos donde está autorizado - CA-11, CA-12, CA-13)
CREATE POLICY "course_mappings_select_authorized" ON public.course_mappings
FOR SELECT TO authenticated
USING (
    public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
    OR EXISTS (
        SELECT 1 FROM public.enrollment_requests er
        WHERE er.course_mapping_id = course_mappings.id
          AND er.user_id = auth.uid()
          AND er.status IN ('autorizada', 'sincronizada')
    )
);

CREATE POLICY "course_mappings_admin_manage" ON public.course_mappings
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10.7 Políticas: enrollment_requests
CREATE POLICY "enrollment_requests_select_own_or_staff" ON public.enrollment_requests
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
);

CREATE POLICY "enrollment_requests_manage_staff" ON public.enrollment_requests
FOR ALL TO authenticated
USING (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador']))
WITH CHECK (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador']));

-- 10.8 Políticas: campus_access_logs
CREATE POLICY "campus_access_logs_select_own_or_admin" ON public.campus_access_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "campus_access_logs_insert_own_or_admin" ON public.campus_access_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 10.9 Políticas: admission_applications
CREATE POLICY "admissions_select_own_or_staff" ON public.admission_applications
FOR SELECT TO authenticated
USING (
    applicant_id = auth.uid()
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte'])
);

CREATE POLICY "admissions_insert_own" ON public.admission_applications
FOR INSERT TO authenticated
WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "admissions_update_own_or_staff" ON public.admission_applications
FOR UPDATE TO authenticated
USING (
    (applicant_id = auth.uid() AND status = 'postulado')
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador'])
)
WITH CHECK (
    (applicant_id = auth.uid() AND status = 'postulado')
    OR public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador'])
);

-- 10.10 Políticas: institutional_directory y cms_contents (Públicos en el portal)
CREATE POLICY "directory_select_public" ON public.institutional_directory
FOR SELECT TO anon, authenticated
USING (is_visible = TRUE OR public.is_admin());

CREATE POLICY "directory_admin_manage" ON public.institutional_directory
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "cms_select_public" ON public.cms_contents
FOR SELECT TO anon, authenticated
USING (status = 'publicado' OR public.is_admin());

CREATE POLICY "cms_admin_manage" ON public.cms_contents
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 10.11 Políticas: contact_messages (Cualquier visitante puede enviar mensaje en /contacto)
CREATE POLICY "contact_insert_public" ON public.contact_messages
FOR INSERT TO anon, authenticated
WITH CHECK (TRUE);

CREATE POLICY "contact_select_staff" ON public.contact_messages
FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte']));

CREATE POLICY "contact_update_staff" ON public.contact_messages
FOR UPDATE TO authenticated
USING (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte']))
WITH CHECK (public.has_any_role(ARRAY['superadministrador', 'administrador', 'coordinador', 'soporte']));

-- 10.12 Políticas: wp_migration_inventory, audit_logs y system_settings
CREATE POLICY "wp_migration_select_public_redirects" ON public.wp_migration_inventory
FOR SELECT TO anon, authenticated
USING (is_redirect_active = TRUE OR public.is_admin());

CREATE POLICY "wp_migration_admin_manage" ON public.wp_migration_inventory
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() OR public.is_admin());

CREATE POLICY "system_settings_select_policy" ON public.system_settings
FOR SELECT TO anon, authenticated
USING (is_public = TRUE OR public.is_admin());

CREATE POLICY "system_settings_superadmin_manage" ON public.system_settings
FOR ALL TO authenticated
USING (public.has_role('superadministrador'))
WITH CHECK (public.has_role('superadministrador'));

-- =================================================================================
-- 11. VISTAS SEGURAS (SECURITY INVOKER) PARA SIMPLIFICAR NEXT.JS Y NESTJS
-- =================================================================================

-- 11.1 Vista consolidada de usuarios, roles y programas para el Panel Administrativo (Sección 10)
CREATE OR REPLACE VIEW public.v_user_complete_profile
WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    TRIM(p.first_name || ' ' || p.last_name) AS full_name,
    p.phone,
    p.matricula,
    p.avatar_url,
    p.status,
    p.moodle_user_id,
    p.moodle_username,
    p.moodle_sync_status,
    p.moodle_last_sync_at,
    p.created_at,
    COALESCE(
        ARRAY_AGG(DISTINCT r.slug) FILTER (WHERE ur.is_active = TRUE AND r.slug IS NOT NULL),
        ARRAY[]::TEXT[]
    ) AS active_roles,
    COALESCE(
        JSONB_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'program_id', prog.id,
                'code', prog.code,
                'name', prog.name,
                'type', prog.type,
                'academic_status', up.status,
                'cohort', up.cohort
            )
        ) FILTER (WHERE prog.id IS NOT NULL),
        '[]'::jsonb
    ) AS programs
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.is_active = TRUE
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.user_programs up ON up.user_id = p.id
LEFT JOIN public.programs prog ON prog.id = up.program_id
GROUP BY p.id;

-- 11.2 Vista de cursos autorizados para el panel "Mi IINICIA" (Secciones 8.2 y 9.2)
CREATE OR REPLACE VIEW public.v_user_authorized_courses
WITH (security_invoker = true)
AS
SELECT
    er.id AS enrollment_id,
    er.user_id,
    er.moodle_role,
    er.status AS enrollment_status,
    er.synced_to_moodle_at,
    er.cached_progress,
    er.cached_final_grade,
    er.cached_completed,
    cm.id AS course_mapping_id,
    cm.portal_course_code,
    cm.slug AS course_slug,
    cm.course_name,
    cm.course_description,
    cm.thumbnail_url,
    cm.moodle_course_id,
    cm.moodle_shortname,
    cm.moodle_course_url,
    prog.id AS program_id,
    prog.name AS program_name,
    prog.slug AS program_slug
FROM public.enrollment_requests er
JOIN public.course_mappings cm ON cm.id = er.course_mapping_id
LEFT JOIN public.programs prog ON prog.id = COALESCE(er.program_id, cm.program_id)
WHERE er.status IN ('autorizada', 'sincronizada')
  AND cm.is_active = TRUE;

-- =================================================================================
-- 12. DATOS SEMILLA OBLIGATORIOS (SEEDS: ROLES, PERMISOS, CURSOS Y CONTENIDOS BASE)
-- =================================================================================

-- 12.1 Catálogo de 7 Roles Oficiales (Sección 6)
INSERT INTO public.roles (slug, name, description, hierarchy_level, default_moodle_archetype, is_system)
VALUES
    ('superadministrador', 'Superadministrador', 'Configuración global, usuarios, roles, integraciones, parámetros y auditoría.', 100, 'manager', TRUE),
    ('administrador', 'Administrador', 'Gestión de usuarios, estados, programas, autorizaciones e inscripciones.', 90, 'manager', TRUE),
    ('coordinador', 'Coordinador', 'Consulta y gestión de usuarios/programas bajo su ámbito.', 70, 'coursecreator', TRUE),
    ('profesor', 'Profesor', 'Perfil docente, consulta de cursos asignados y acceso al campus.', 50, 'editingteacher', TRUE),
    ('estudiante', 'Estudiante', 'Perfil, programa, cursos asignados y acceso al campus.', 30, 'student', TRUE),
    ('soporte', 'Soporte', 'Atención operativa limitada y consulta controlada.', 20, NULL, TRUE),
    ('aspirante', 'Aspirante', 'Registro, actualización de datos y seguimiento de admisión. Sin acceso a cursos hasta ser autorizado.', 10, NULL, TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level,
    default_moodle_archetype = EXCLUDED.default_moodle_archetype;

-- 12.2 Catálogo de Permisos Granulares
INSERT INTO public.permissions (code, module, description)
VALUES
    ('system.settings.manage', 'system', 'Configurar parámetros globales e integraciones'),
    ('audit.logs.read', 'audit', 'Visualizar bitácora de auditoría'),
    ('users.read', 'users', 'Consultar listado y detalle de usuarios'),
    ('users.manage', 'users', 'Autorizar, suspender y editar perfiles de usuarios'),
    ('roles.assign', 'roles', 'Asignar o revocar roles de usuarios'),
    ('programs.manage', 'programs', 'Crear y editar programas académicos'),
    ('courses.manage', 'courses', 'Configurar mapeo de cursos con Moodle'),
    ('enrollments.authorize', 'enrollments', 'Autorizar matrículas y asignaciones docentes'),
    ('moodle.sync.execute', 'moodle', 'Ejecutar sincronización de usuarios y matrículas con Moodle'),
    ('campus.access', 'campus', 'Acceder al campus Moodle en cursos autorizados'),
    ('cms.manage', 'cms', 'Gestionar noticias, páginas, directorio y migración WP'),
    ('admissions.review', 'admissions', 'Revisar y dictaminar solicitudes de admisión')
ON CONFLICT (code) DO NOTHING;

-- 12.3 Asignación de Permisos a Roles
-- Superadministrador: todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'superadministrador'
ON CONFLICT DO NOTHING;

-- Administrador: todos excepto system.settings.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'administrador' AND p.code <> 'system.settings.manage'
ON CONFLICT DO NOTHING;

-- Coordinador: lectura de usuarios, autorización de matrículas, revisión de admisiones y acceso a campus
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'coordinador'
  AND p.code IN ('users.read', 'enrollments.authorize', 'admissions.review', 'campus.access')
ON CONFLICT DO NOTHING;

-- Profesor y Estudiante: acceso al campus en cursos autorizados
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('profesor', 'estudiante')
  AND p.code = 'campus.access'
ON CONFLICT DO NOTHING;

-- Soporte: consulta controlada de usuarios
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'soporte'
  AND p.code = 'users.read'
ON CONFLICT DO NOTHING;

-- 12.4 Programas Académicos Iniciales (Sección 8.1)
INSERT INTO public.programs (code, slug, name, short_description, description, type, modality, duration_text, duration_hours, is_featured, is_active, display_order)
VALUES
    (
        'PROG-TI-001',
        'introduccion-a-las-tecnologias-de-la-informacion',
        'Introducción a las Tecnologías de la Información',
        'Fundamentos esenciales de infraestructura digital, redes, software y herramientas tecnológicas.',
        'Programa formativo diseñado para desarrollar competencias sólidas en tecnologías de la información, arquitectura de cómputo, sistemas operativos y entornos colaborativos.',
        'curso',
        'en_linea',
        '4 semanas',
        40,
        TRUE,
        TRUE,
        1
    ),
    (
        'PROG-WEB-002',
        'desarrollo-web-con-react',
        'Desarrollo Web con React',
        'Construcción de interfaces modernas, componentes reutilizables, hooks y arquitecturas frontend con React y Next.js.',
        'Curso práctico orientado al desarrollo de aplicaciones web de alto rendimiento utilizando React, TypeScript, manejo de estado e integración segura con APIs REST.',
        'curso',
        'en_linea',
        '6 semanas',
        60,
        TRUE,
        TRUE,
        2
    )
ON CONFLICT (code) DO NOTHING;

-- 12.5 Los 2 Cursos de Ejemplo Obligatorios en Moodle (Sección 8.1)
INSERT INTO public.course_mappings (
    program_id, portal_course_code, slug, course_name, course_description,
    term_or_module, is_mandatory, moodle_course_id, moodle_shortname, is_active
)
VALUES
    (
        (SELECT id FROM public.programs WHERE code = 'PROG-TI-001'),
        'CUR-MOO-001',
        'curso-1-introduccion-a-las-tecnologias-de-la-informacion',
        'Curso 1. Introducción a las Tecnologías de la Información',
        'Incluye presentación del curso, recurso PDF o página, foro, tarea, cuestionario, calificación y finalización de actividad.',
        1,
        TRUE,
        2,
        'IINICIA-TI-101',
        TRUE
    ),
    (
        (SELECT id FROM public.programs WHERE code = 'PROG-WEB-002'),
        'CUR-MOO-002',
        'curso-2-desarrollo-web-con-react',
        'Curso 2. Desarrollo Web con React',
        'Incluye unidades o temas, recurso, actividad práctica, foro, cuestionario o evaluación, calificación y finalización de curso.',
        1,
        TRUE,
        3,
        'IINICIA-REACT-102',
        TRUE
    )
ON CONFLICT (portal_course_code) DO NOTHING;

-- 12.6 Páginas Institucionales Base (Sección 9.1: Universidad, Misión, Visión, Modelo Educativo)
INSERT INTO public.cms_contents (slug, title, excerpt, body_content, content_type, status, published_at)
VALUES
    (
        'quienes-somos',
        'Quiénes Somos - IINICIA',
        'Conoce la identidad, misión, visión y valores de IINICIA.',
        '## Misión\nFormar profesionales líderes mediante programas educativos innovadores y flexibles.\n\n## Visión\nSer una institución referente en educación digital y continua en América Latina.',
        'pagina',
        'publicado',
        NOW()
    ),
    (
        'modelo-educativo',
        'Modelo Educativo IINICIA',
        'Aprendizaje centrado en el estudiante e impulsado por plataformas tecnológicas.',
        'Nuestro modelo educativo integra acompañamiento docente, evaluación práctica continua y acceso 24/7 a través de nuestro campus virtual.',
        'pagina',
        'publicado',
        NOW()
    )
ON CONFLICT (slug) DO NOTHING;

-- 12.7 Configuración Inicial del Sistema
INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
    ('portal.general', '{"institution_name": "IINICIA", "support_email": "contacto@iinicia.org", "admissions_open": true}'::jsonb, 'Configuración pública general del portal', TRUE),
    ('moodle.integration', '{"auto_create_user_on_role_assign": true, "default_auth_method": "manual", "sync_enabled": true}'::jsonb, 'Parámetros de sincronización con Moodle LMS', FALSE)
ON CONFLICT (key) DO NOTHING;

COMMIT;
