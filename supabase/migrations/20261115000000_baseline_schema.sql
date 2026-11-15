-- =================================================================================
-- PROYECTO: PORTAL IINICIA
-- LINEA BASE UNIFICADA DE SUPABASE / POSTGRESQL
-- Version: 20261115000000_baseline_schema.sql
-- =================================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.12 (Debian 17.12-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: academic_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.academic_status AS ENUM (
    'postulado',
    'en_revision',
    'admitido',
    'rechazado',
    'inscrito',
    'cursando',
    'egresado',
    'baja',
    'suspendido'
);


ALTER TYPE public.academic_status OWNER TO postgres;

--
-- Name: cms_content_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cms_content_status AS ENUM (
    'borrador',
    'publicado',
    'archivado'
);


ALTER TYPE public.cms_content_status OWNER TO postgres;

--
-- Name: cms_content_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cms_content_type AS ENUM (
    'pagina',
    'noticia',
    'aviso',
    'evento',
    'faq',
    'documento'
);


ALTER TYPE public.cms_content_type OWNER TO postgres;

--
-- Name: contact_message_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.contact_message_status AS ENUM (
    'nuevo',
    'en_atencion',
    'resuelto',
    'spam'
);


ALTER TYPE public.contact_message_status OWNER TO postgres;

--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enrollment_status AS ENUM (
    'pendiente',
    'autorizada',
    'rechazada',
    'sincronizada',
    'error_sincronizacion',
    'desmatriculada'
);


ALTER TYPE public.enrollment_status OWNER TO postgres;

--
-- Name: moodle_role_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.moodle_role_type AS ENUM (
    'student',
    'editingteacher',
    'teacher',
    'manager',
    'coursecreator'
);


ALTER TYPE public.moodle_role_type OWNER TO postgres;

--
-- Name: program_modality; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.program_modality AS ENUM (
    'en_linea',
    'presencial',
    'hibrido',
    'autogestivo'
);


ALTER TYPE public.program_modality OWNER TO postgres;

--
-- Name: program_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.program_type AS ENUM (
    'licenciatura',
    'maestria',
    'diplomado',
    'certificacion',
    'curso',
    'taller',
    'otro'
);


ALTER TYPE public.program_type OWNER TO postgres;

--
-- Name: sync_status_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sync_status_type AS ENUM (
    'no_vinculado',
    'pendiente',
    'sincronizado',
    'error',
    'suspendido_en_moodle'
);


ALTER TYPE public.sync_status_type OWNER TO postgres;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_status AS ENUM (
    'pendiente',
    'activo',
    'suspendido',
    'inactivo',
    'baja'
);


ALTER TYPE public.user_status OWNER TO postgres;

--
-- Name: wp_migration_action; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.wp_migration_action AS ENUM (
    'MIGRAR',
    'ACTUALIZAR',
    'REESCRIBIR',
    'ELIMINAR'
);


ALTER TYPE public.wp_migration_action OWNER TO postgres;

--
-- Name: audit_academic_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_academic_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.audit_academic_changes() OWNER TO postgres;

--
-- Name: audit_profile_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.audit_profile_changes() OWNER TO postgres;

--
-- Name: audit_user_role_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_user_role_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.audit_user_role_changes() OWNER TO postgres;

--
-- Name: get_my_roles(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_roles() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT COALESCE(ARRAY_AGG(r.slug ORDER BY r.hierarchy_level DESC), ARRAY[]::TEXT[])
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
$$;


ALTER FUNCTION public.get_my_roles() OWNER TO postgres;

--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'last_name'), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles as r
  where r.code = 'applicant'
  on conflict (user_id, role_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_any_role(text[], uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_any_role(required_role_slugs text[], target_uid uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.has_any_role(required_role_slugs text[], target_uid uuid) OWNER TO postgres;

--
-- Name: has_permission(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_permission(required_permission_code text, target_uid uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.has_permission(required_permission_code text, target_uid uuid) OWNER TO postgres;

--
-- Name: has_role(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(required_role_slug text, target_uid uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.has_role(required_role_slug text, target_uid uuid) OWNER TO postgres;

--
-- Name: iinicia_require_mfa(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.iinicia_require_mfa() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF current_user = 'authenticated' AND (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Completa la verificación en dos pasos.';
  END IF;
END;
$$;


ALTER FUNCTION public.iinicia_require_mfa() OWNER TO postgres;

--
-- Name: iinicia_review_admission(uuid, uuid, public.academic_status, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.iinicia_review_admission(application_id uuid, reviewer_id uuid, decision public.academic_status, notes text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
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


ALTER FUNCTION public.iinicia_review_admission(application_id uuid, reviewer_id uuid, decision public.academic_status, notes text) OWNER TO postgres;

--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin(target_uid uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT public.has_any_role(ARRAY['superadministrador', 'administrador'], target_uid);
$$;


ALTER FUNCTION public.is_admin(target_uid uuid) OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admission_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admission_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    applicant_id uuid NOT NULL,
    program_id uuid NOT NULL,
    status public.academic_status DEFAULT 'postulado'::public.academic_status NOT NULL,
    previous_education_level text,
    previous_institution text,
    average_grade numeric(4,2),
    motivation_letter text,
    documents_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    reviewer_id uuid,
    reviewer_notes text,
    reviewed_at timestamp with time zone,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admission_applications OWNER TO postgres;

--
-- Name: TABLE admission_applications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admission_applications IS 'Solicitudes de admisión y seguimiento de aspirantes.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    target_user_id uuid,
    action text NOT NULL,
    entity_name text NOT NULL,
    entity_id text,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Bitácora inmutable de acciones administrativas, cambios de rol, estados y sincronizaciones.';


--
-- Name: campus_access_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campus_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_mapping_id uuid,
    moodle_course_id bigint,
    access_method text DEFAULT 'sso_backend_redirect'::text NOT NULL,
    ip_address text,
    user_agent text,
    succeeded boolean DEFAULT true NOT NULL,
    error_detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.campus_access_logs OWNER TO postgres;

--
-- Name: TABLE campus_access_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.campus_access_logs IS 'Registro de accesos desde Mi IINICIA hacia el Campus Moodle (Sección 11).';


--
-- Name: cms_contents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cms_contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body_content text NOT NULL,
    content_type public.cms_content_type DEFAULT 'noticia'::public.cms_content_type NOT NULL,
    status public.cms_content_status DEFAULT 'borrador'::public.cms_content_status NOT NULL,
    featured_image_url text,
    author_id uuid,
    published_at timestamp with time zone,
    seo_title text,
    seo_description text,
    legacy_wp_id bigint,
    legacy_wp_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cms_contents OWNER TO postgres;

--
-- Name: TABLE cms_contents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cms_contents IS 'Repositorio de noticias, páginas estáticas (Misión, Visión, Modelo Educativo) y avisos.';


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    subject text NOT NULL,
    program_of_interest uuid,
    message text NOT NULL,
    status public.contact_message_status DEFAULT 'nuevo'::public.contact_message_status NOT NULL,
    attended_by uuid,
    internal_notes text,
    ip_address text,
    attended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_messages OWNER TO postgres;

--
-- Name: TABLE contact_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contact_messages IS 'Mensajes recibidos desde el formulario público de contacto.';


--
-- Name: course_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid,
    portal_course_code text NOT NULL,
    slug text NOT NULL,
    course_name text NOT NULL,
    course_description text,
    thumbnail_url text,
    term_or_module smallint DEFAULT 1,
    is_mandatory boolean DEFAULT true NOT NULL,
    moodle_course_id bigint NOT NULL,
    moodle_shortname text NOT NULL,
    moodle_category_id bigint,
    moodle_course_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.course_mappings OWNER TO postgres;

--
-- Name: TABLE course_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.course_mappings IS 'Mapeo exacto entre cursos del portal y el course_id dentro de Moodle.';


--
-- Name: enrollment_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrollment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_mapping_id uuid NOT NULL,
    program_id uuid,
    moodle_role public.moodle_role_type DEFAULT 'student'::public.moodle_role_type NOT NULL,
    status public.enrollment_status DEFAULT 'pendiente'::public.enrollment_status NOT NULL,
    requested_by uuid,
    authorized_by uuid,
    authorized_at timestamp with time zone,
    moodle_enrol_id bigint,
    synced_to_moodle_at timestamp with time zone,
    sync_attempts smallint DEFAULT 0 NOT NULL,
    sync_error_message text,
    cached_progress numeric(5,2) DEFAULT 0.00,
    cached_final_grade numeric(6,2),
    cached_completed boolean DEFAULT false,
    last_moodle_access_at timestamp with time zone,
    access_start_at timestamp with time zone,
    access_end_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.enrollment_requests OWNER TO postgres;

--
-- Name: TABLE enrollment_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.enrollment_requests IS 'Control de matrículas (estudiantes y docentes) y estado de sincronización con Moodle.';


--
-- Name: institutional_directory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.institutional_directory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    full_name text NOT NULL,
    title_or_position text NOT NULL,
    department text,
    category text DEFAULT 'autoridad'::text NOT NULL,
    bio text,
    photo_url text,
    email_contact text,
    linkedin_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.institutional_directory OWNER TO postgres;

--
-- Name: TABLE institutional_directory; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.institutional_directory IS 'Directorio público de autoridades universitarias y cuerpo docente (Sección 9.1).';


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id smallint NOT NULL,
    code text NOT NULL,
    module text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: TABLE permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.permissions IS 'Catálogo de permisos granulares por módulo para validación en Backend y RLS.';


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    phone text,
    curp_or_id text,
    matricula text,
    avatar_url text,
    bio text,
    status public.user_status DEFAULT 'pendiente'::public.user_status NOT NULL,
    moodle_user_id bigint,
    moodle_username text,
    moodle_sync_status public.sync_status_type DEFAULT 'no_vinculado'::public.sync_status_type NOT NULL,
    moodle_last_sync_at timestamp with time zone,
    moodle_sync_error text,
    last_login_at timestamp with time zone,
    terms_accepted_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profiles IS 'Perfil institucional del usuario, estado administrativo y vínculo con Moodle.';


--
-- Name: programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    short_description text,
    description text,
    type public.program_type DEFAULT 'curso'::public.program_type NOT NULL,
    modality public.program_modality DEFAULT 'en_linea'::public.program_modality NOT NULL,
    duration_text text,
    duration_hours integer,
    credits integer,
    banner_url text,
    thumbnail_url text,
    syllabus_pdf_url text,
    admission_requirements jsonb DEFAULT '[]'::jsonb NOT NULL,
    graduate_profile text,
    moodle_category_id bigint,
    coordinator_id uuid,
    is_featured boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    seo_title text,
    seo_description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.programs OWNER TO postgres;

--
-- Name: TABLE programs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.programs IS 'Catálogo de programas académicos mostrados en Oferta Académica y vinculados a usuarios.';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id smallint NOT NULL,
    permission_id smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.role_permissions IS 'Asignación de permisos específicos a cada rol.';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id smallint NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    hierarchy_level smallint DEFAULT 10 NOT NULL,
    default_moodle_archetype public.moodle_role_type,
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'Catálogo de roles del portal (RBAC).';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.system_settings IS 'Parámetros globales de configuración del portal e integración con Moodle.';


--
-- Name: user_programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    program_id uuid NOT NULL,
    status public.academic_status DEFAULT 'postulado'::public.academic_status NOT NULL,
    cohort text,
    progress_percentage numeric(5,2) DEFAULT 0.00 NOT NULL,
    authorized_by uuid,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_programs_progress_percentage_check CHECK (((progress_percentage >= (0)::numeric) AND (progress_percentage <= (100)::numeric)))
);


ALTER TABLE public.user_programs OWNER TO postgres;

--
-- Name: TABLE user_programs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_programs IS 'Trayectoria académica del usuario dentro de un programa.';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id smallint NOT NULL,
    assigned_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_roles IS 'Relación usuario-rol con soporte para múltiples roles activos.';


--
-- Name: v_user_authorized_courses; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_authorized_courses WITH (security_invoker='true') AS
 SELECT er.id AS enrollment_id,
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
   FROM ((public.enrollment_requests er
     JOIN public.course_mappings cm ON ((cm.id = er.course_mapping_id)))
     LEFT JOIN public.programs prog ON ((prog.id = COALESCE(er.program_id, cm.program_id))))
  WHERE ((er.status = ANY (ARRAY['autorizada'::public.enrollment_status, 'sincronizada'::public.enrollment_status])) AND (cm.is_active = true));


ALTER VIEW public.v_user_authorized_courses OWNER TO postgres;

--
-- Name: v_user_complete_profile; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_complete_profile AS
SELECT
    NULL::uuid AS id,
    NULL::text AS email,
    NULL::text AS first_name,
    NULL::text AS last_name,
    NULL::text AS full_name,
    NULL::text AS phone,
    NULL::text AS matricula,
    NULL::text AS avatar_url,
    NULL::public.user_status AS status,
    NULL::bigint AS moodle_user_id,
    NULL::text AS moodle_username,
    NULL::public.sync_status_type AS moodle_sync_status,
    NULL::timestamp with time zone AS moodle_last_sync_at,
    NULL::timestamp with time zone AS created_at,
    NULL::text[] AS active_roles,
    NULL::jsonb AS programs;


ALTER VIEW public.v_user_complete_profile OWNER TO postgres;

--
-- Name: wp_migration_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wp_migration_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legacy_url text NOT NULL,
    legacy_title text,
    asset_type text DEFAULT 'page'::text NOT NULL,
    action public.wp_migration_action DEFAULT 'MIGRAR'::public.wp_migration_action NOT NULL,
    new_target_url text,
    http_redirect_code smallint DEFAULT 301,
    is_redirect_active boolean DEFAULT true NOT NULL,
    migration_completed boolean DEFAULT false NOT NULL,
    seo_notes text,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wp_migration_inventory_http_redirect_code_check CHECK ((http_redirect_code = ANY (ARRAY[301, 302, 307, 308, 410])))
);


ALTER TABLE public.wp_migration_inventory OWNER TO postgres;

--
-- Name: TABLE wp_migration_inventory; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.wp_migration_inventory IS 'Inventario auditable de migración desde WordPress y mapa de redirecciones 301 (Secciones 12 y 18).';


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: admission_applications admission_applications_applicant_id_program_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_applicant_id_program_id_key UNIQUE (applicant_id, program_id);


--
-- Name: admission_applications admission_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: campus_access_logs campus_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campus_access_logs
    ADD CONSTRAINT campus_access_logs_pkey PRIMARY KEY (id);


--
-- Name: cms_contents cms_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_contents
    ADD CONSTRAINT cms_contents_pkey PRIMARY KEY (id);


--
-- Name: cms_contents cms_contents_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_contents
    ADD CONSTRAINT cms_contents_slug_key UNIQUE (slug);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: course_mappings course_mappings_moodle_course_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_moodle_course_id_key UNIQUE (moodle_course_id);


--
-- Name: course_mappings course_mappings_moodle_shortname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_moodle_shortname_key UNIQUE (moodle_shortname);


--
-- Name: course_mappings course_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_pkey PRIMARY KEY (id);


--
-- Name: course_mappings course_mappings_portal_course_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_portal_course_code_key UNIQUE (portal_course_code);


--
-- Name: course_mappings course_mappings_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_slug_key UNIQUE (slug);


--
-- Name: enrollment_requests enrollment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_pkey PRIMARY KEY (id);


--
-- Name: enrollment_requests enrollment_requests_user_id_course_mapping_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_user_id_course_mapping_id_key UNIQUE (user_id, course_mapping_id);


--
-- Name: institutional_directory institutional_directory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.institutional_directory
    ADD CONSTRAINT institutional_directory_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_curp_or_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_curp_or_id_key UNIQUE (curp_or_id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_matricula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_matricula_key UNIQUE (matricula);


--
-- Name: profiles profiles_moodle_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_moodle_user_id_key UNIQUE (moodle_user_id);


--
-- Name: profiles profiles_moodle_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_moodle_username_key UNIQUE (moodle_username);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: programs programs_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_code_key UNIQUE (code);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: programs programs_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_slug_key UNIQUE (slug);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_programs user_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_programs
    ADD CONSTRAINT user_programs_pkey PRIMARY KEY (id);


--
-- Name: user_programs user_programs_user_id_program_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_programs
    ADD CONSTRAINT user_programs_user_id_program_id_key UNIQUE (user_id, program_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: wp_migration_inventory wp_migration_inventory_legacy_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wp_migration_inventory
    ADD CONSTRAINT wp_migration_inventory_legacy_url_key UNIQUE (legacy_url);


--
-- Name: wp_migration_inventory wp_migration_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wp_migration_inventory
    ADD CONSTRAINT wp_migration_inventory_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_actor_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_actor_created ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_target_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_target_created ON public.audit_logs USING btree (target_user_id, created_at DESC);


--
-- Name: idx_cms_contents_slug_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cms_contents_slug_status ON public.cms_contents USING btree (slug, status);


--
-- Name: idx_course_mappings_moodle_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_mappings_moodle_id ON public.course_mappings USING btree (moodle_course_id);


--
-- Name: idx_course_mappings_program; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_mappings_program ON public.course_mappings USING btree (program_id);


--
-- Name: idx_enrollment_requests_course; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollment_requests_course ON public.enrollment_requests USING btree (course_mapping_id);


--
-- Name: idx_enrollment_requests_moodle_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollment_requests_moodle_role ON public.enrollment_requests USING btree (moodle_role);


--
-- Name: idx_enrollment_requests_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollment_requests_user_status ON public.enrollment_requests USING btree (user_id, status);


--
-- Name: idx_profiles_moodle_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_moodle_sync_status ON public.profiles USING btree (moodle_sync_status);


--
-- Name: idx_profiles_moodle_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_moodle_user_id ON public.profiles USING btree (moodle_user_id);


--
-- Name: idx_profiles_search_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_search_trgm ON public.profiles USING gin ((((((first_name || ' '::text) || last_name) || ' '::text) || email)) public.gin_trgm_ops);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);


--
-- Name: idx_programs_slug_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_programs_slug_active ON public.programs USING btree (slug) WHERE (is_active = true);


--
-- Name: idx_programs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_programs_type ON public.programs USING btree (type);


--
-- Name: idx_user_programs_program; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_programs_program ON public.user_programs USING btree (program_id);


--
-- Name: idx_user_programs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_programs_status ON public.user_programs USING btree (status);


--
-- Name: idx_user_programs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_programs_user ON public.user_programs USING btree (user_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_user_active ON public.user_roles USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_wp_migration_legacy_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wp_migration_legacy_url ON public.wp_migration_inventory USING btree (legacy_url) WHERE (is_redirect_active = true);


--
-- Name: v_user_complete_profile _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.v_user_complete_profile WITH (security_invoker='true') AS
 SELECT p.id,
    p.email,
    p.first_name,
    p.last_name,
    TRIM(BOTH FROM ((p.first_name || ' '::text) || p.last_name)) AS full_name,
    p.phone,
    p.matricula,
    p.avatar_url,
    p.status,
    p.moodle_user_id,
    p.moodle_username,
    p.moodle_sync_status,
    p.moodle_last_sync_at,
    p.created_at,
    COALESCE(array_agg(DISTINCT r.slug) FILTER (WHERE ((ur.is_active = true) AND (r.slug IS NOT NULL))), ARRAY[]::text[]) AS active_roles,
    COALESCE(jsonb_agg(DISTINCT jsonb_build_object('program_id', prog.id, 'code', prog.code, 'name', prog.name, 'type', prog.type, 'academic_status', up.status, 'cohort', up.cohort)) FILTER (WHERE (prog.id IS NOT NULL)), '[]'::jsonb) AS programs
   FROM ((((public.profiles p
     LEFT JOIN public.user_roles ur ON (((ur.user_id = p.id) AND (ur.is_active = true))))
     LEFT JOIN public.roles r ON ((r.id = ur.role_id)))
     LEFT JOIN public.user_programs up ON ((up.user_id = p.id)))
     LEFT JOIN public.programs prog ON ((prog.id = up.program_id)))
  GROUP BY p.id;


--
-- Name: admission_applications trg_admission_applications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_admission_applications_updated_at BEFORE UPDATE ON public.admission_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: enrollment_requests trg_audit_enrollment_requests; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_enrollment_requests AFTER INSERT OR UPDATE ON public.enrollment_requests FOR EACH ROW EXECUTE FUNCTION public.audit_academic_changes();


--
-- Name: profiles trg_audit_profile_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_profile_changes AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();


--
-- Name: user_programs trg_audit_user_programs; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_user_programs AFTER INSERT OR UPDATE ON public.user_programs FOR EACH ROW EXECUTE FUNCTION public.audit_academic_changes();


--
-- Name: user_roles trg_audit_user_roles; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();


--
-- Name: cms_contents trg_cms_contents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cms_contents_updated_at BEFORE UPDATE ON public.cms_contents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contact_messages trg_contact_messages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_contact_messages_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: course_mappings trg_course_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_course_mappings_updated_at BEFORE UPDATE ON public.course_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: enrollment_requests trg_enrollment_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enrollment_requests_updated_at BEFORE UPDATE ON public.enrollment_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: institutional_directory trg_institutional_directory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_institutional_directory_updated_at BEFORE UPDATE ON public.institutional_directory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: programs trg_programs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_settings trg_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_programs trg_user_programs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_programs_updated_at BEFORE UPDATE ON public.user_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_roles trg_user_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: wp_migration_inventory trg_wp_migration_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wp_migration_inventory_updated_at BEFORE UPDATE ON public.wp_migration_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admission_applications admission_applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admission_applications admission_applications_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: admission_applications admission_applications_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campus_access_logs campus_access_logs_course_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campus_access_logs
    ADD CONSTRAINT campus_access_logs_course_mapping_id_fkey FOREIGN KEY (course_mapping_id) REFERENCES public.course_mappings(id) ON DELETE SET NULL;


--
-- Name: campus_access_logs campus_access_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campus_access_logs
    ADD CONSTRAINT campus_access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: cms_contents cms_contents_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_contents
    ADD CONSTRAINT cms_contents_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contact_messages contact_messages_attended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_attended_by_fkey FOREIGN KEY (attended_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contact_messages contact_messages_program_of_interest_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_program_of_interest_fkey FOREIGN KEY (program_of_interest) REFERENCES public.programs(id) ON DELETE SET NULL;


--
-- Name: course_mappings course_mappings_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_mappings
    ADD CONSTRAINT course_mappings_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;


--
-- Name: enrollment_requests enrollment_requests_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: enrollment_requests enrollment_requests_course_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_course_mapping_id_fkey FOREIGN KEY (course_mapping_id) REFERENCES public.course_mappings(id) ON DELETE RESTRICT;


--
-- Name: enrollment_requests enrollment_requests_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;


--
-- Name: enrollment_requests enrollment_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: enrollment_requests enrollment_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollment_requests
    ADD CONSTRAINT enrollment_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: institutional_directory institutional_directory_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.institutional_directory
    ADD CONSTRAINT institutional_directory_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: programs programs_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_programs user_programs_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_programs
    ADD CONSTRAINT user_programs_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_programs user_programs_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_programs
    ADD CONSTRAINT user_programs_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: user_programs user_programs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_programs
    ADD CONSTRAINT user_programs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wp_migration_inventory wp_migration_inventory_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wp_migration_inventory
    ADD CONSTRAINT wp_migration_inventory_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: admission_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: admission_applications admissions_delete_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_delete_via_backend_only ON public.admission_applications AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);


--
-- Name: admission_applications admissions_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_insert_own ON public.admission_applications FOR INSERT TO authenticated WITH CHECK ((applicant_id = auth.uid()));


--
-- Name: admission_applications admissions_insert_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_insert_via_backend_only ON public.admission_applications AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: admission_applications admissions_limit_read_scope; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_limit_read_scope ON public.admission_applications AS RESTRICTIVE FOR SELECT TO authenticated USING (((applicant_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.has_role('coordinador'::text) AND (EXISTS ( SELECT 1
   FROM public.user_programs membership
  WHERE ((membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.program_id = admission_applications.program_id) AND (membership.status = ANY (ARRAY['admitido'::public.academic_status, 'inscrito'::public.academic_status, 'cursando'::public.academic_status]))))))));


--
-- Name: admission_applications admissions_select_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_select_own_or_staff ON public.admission_applications FOR SELECT TO authenticated USING (((applicant_id = auth.uid()) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])));


--
-- Name: admission_applications admissions_update_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_update_own_or_staff ON public.admission_applications FOR UPDATE TO authenticated USING ((((applicant_id = auth.uid()) AND (status = 'postulado'::public.academic_status)) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text]))) WITH CHECK ((((applicant_id = auth.uid()) AND (status = 'postulado'::public.academic_status)) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text])));


--
-- Name: admission_applications admissions_update_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admissions_update_via_backend_only ON public.admission_applications AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_admin_select ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: audit_logs audit_logs_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (((actor_id = auth.uid()) OR public.is_admin()));


--
-- Name: campus_access_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campus_access_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: campus_access_logs campus_access_logs_insert_own_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campus_access_logs_insert_own_or_admin ON public.campus_access_logs FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: campus_access_logs campus_access_logs_select_own_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campus_access_logs_select_own_or_admin ON public.campus_access_logs FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: cms_contents cms_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cms_admin_manage ON public.cms_contents TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: cms_contents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cms_contents ENABLE ROW LEVEL SECURITY;

--
-- Name: cms_contents cms_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cms_select_public ON public.cms_contents FOR SELECT TO authenticated, anon USING (((status = 'publicado'::public.cms_content_status) OR public.is_admin()));


--
-- Name: contact_messages contact_insert_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_insert_public ON public.contact_messages FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages contact_select_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_select_staff ON public.contact_messages FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text]));


--
-- Name: contact_messages contact_update_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_update_staff ON public.contact_messages FOR UPDATE TO authenticated USING (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])) WITH CHECK (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text]));


--
-- Name: course_mappings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.course_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: course_mappings course_mappings_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY course_mappings_admin_manage ON public.course_mappings TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: course_mappings course_mappings_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY course_mappings_select_authorized ON public.course_mappings FOR SELECT TO authenticated USING ((public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text]) OR (EXISTS ( SELECT 1
   FROM public.enrollment_requests er
  WHERE ((er.course_mapping_id = course_mappings.id) AND (er.user_id = auth.uid()) AND (er.status = ANY (ARRAY['autorizada'::public.enrollment_status, 'sincronizada'::public.enrollment_status])))))));


--
-- Name: course_mappings course_mappings_select_offer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY course_mappings_select_offer ON public.course_mappings FOR SELECT TO authenticated USING ((is_active AND (( SELECT (auth.jwt() ->> 'aal'::text)) = 'aal2'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles viewer
  WHERE ((viewer.id = ( SELECT auth.uid() AS uid)) AND (viewer.status = ANY (ARRAY['activo'::public.user_status, 'pendiente'::public.user_status])))))));


--
-- Name: institutional_directory directory_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY directory_admin_manage ON public.institutional_directory TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: institutional_directory directory_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY directory_select_public ON public.institutional_directory FOR SELECT TO authenticated, anon USING (((is_visible = true) OR public.is_admin()));


--
-- Name: enrollment_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollment_requests enrollment_requests_manage_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY enrollment_requests_manage_staff ON public.enrollment_requests TO authenticated USING (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text])) WITH CHECK (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text]));


--
-- Name: enrollment_requests enrollment_requests_select_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY enrollment_requests_select_own_or_staff ON public.enrollment_requests FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])));


--
-- Name: institutional_directory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.institutional_directory ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY permissions_select_authenticated ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: permissions permissions_superadmin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY permissions_superadmin_manage ON public.permissions TO authenticated USING (public.has_role('superadministrador'::text)) WITH CHECK (public.has_role('superadministrador'::text));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_admin_all ON public.profiles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles profiles_select_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_own_or_staff ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])));


--
-- Name: profiles profiles_update_own_safe; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_own_safe ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (status = ( SELECT p.status
   FROM public.profiles p
  WHERE (p.id = auth.uid()))) AND (NOT (moodle_user_id IS DISTINCT FROM ( SELECT p.moodle_user_id
   FROM public.profiles p
  WHERE (p.id = auth.uid())))) AND (moodle_sync_status = ( SELECT p.moodle_sync_status
   FROM public.profiles p
  WHERE (p.id = auth.uid())))));


--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

--
-- Name: programs programs_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programs_admin_manage ON public.programs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: programs programs_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programs_select_public ON public.programs FOR SELECT TO authenticated, anon USING (((is_active = true) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text])));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY role_permissions_select_authenticated ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions role_permissions_superadmin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY role_permissions_superadmin_manage ON public.role_permissions TO authenticated USING (public.has_role('superadministrador'::text)) WITH CHECK (public.has_role('superadministrador'::text));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: roles roles_superadmin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_superadmin_manage ON public.roles TO authenticated USING (public.has_role('superadministrador'::text)) WITH CHECK (public.has_role('superadministrador'::text));


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY system_settings_select_policy ON public.system_settings FOR SELECT TO authenticated, anon USING (((is_public = true) OR public.is_admin()));


--
-- Name: system_settings system_settings_superadmin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY system_settings_superadmin_manage ON public.system_settings TO authenticated USING (public.has_role('superadministrador'::text)) WITH CHECK (public.has_role('superadministrador'::text));


--
-- Name: user_programs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_programs user_programs_delete_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_programs_delete_via_backend_only ON public.user_programs AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);


--
-- Name: user_programs user_programs_insert_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_programs_insert_via_backend_only ON public.user_programs AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: user_programs user_programs_manage_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_programs_manage_staff ON public.user_programs TO authenticated USING (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text])) WITH CHECK (public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text]));


--
-- Name: user_programs user_programs_select_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_programs_select_own_or_staff ON public.user_programs FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])));


--
-- Name: user_programs user_programs_update_via_backend_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_programs_update_via_backend_only ON public.user_programs AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_admin_manage ON public.user_roles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_roles user_roles_select_own_or_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_select_own_or_staff ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role(ARRAY['superadministrador'::text, 'administrador'::text, 'coordinador'::text, 'soporte'::text])));


--
-- Name: wp_migration_inventory wp_migration_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wp_migration_admin_manage ON public.wp_migration_inventory TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: wp_migration_inventory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wp_migration_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: wp_migration_inventory wp_migration_select_public_redirects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wp_migration_select_public_redirects ON public.wp_migration_inventory FOR SELECT TO authenticated, anon USING (((is_redirect_active = true) OR public.is_admin()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION audit_academic_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_academic_changes() TO anon;
GRANT ALL ON FUNCTION public.audit_academic_changes() TO authenticated;
GRANT ALL ON FUNCTION public.audit_academic_changes() TO service_role;


--
-- Name: FUNCTION audit_profile_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_profile_changes() TO anon;
GRANT ALL ON FUNCTION public.audit_profile_changes() TO authenticated;
GRANT ALL ON FUNCTION public.audit_profile_changes() TO service_role;


--
-- Name: FUNCTION audit_user_role_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_user_role_changes() TO anon;
GRANT ALL ON FUNCTION public.audit_user_role_changes() TO authenticated;
GRANT ALL ON FUNCTION public.audit_user_role_changes() TO service_role;


--
-- Name: FUNCTION get_my_roles(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_my_roles() TO anon;
GRANT ALL ON FUNCTION public.get_my_roles() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_roles() TO service_role;


--
-- Name: FUNCTION handle_new_auth_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_auth_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_any_role(required_role_slugs text[], target_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_any_role(required_role_slugs text[], target_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.has_any_role(required_role_slugs text[], target_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_any_role(required_role_slugs text[], target_uid uuid) TO service_role;


--
-- Name: FUNCTION has_permission(required_permission_code text, target_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_permission(required_permission_code text, target_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.has_permission(required_permission_code text, target_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(required_permission_code text, target_uid uuid) TO service_role;


--
-- Name: FUNCTION has_role(required_role_slug text, target_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(required_role_slug text, target_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.has_role(required_role_slug text, target_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(required_role_slug text, target_uid uuid) TO service_role;


--
-- Name: FUNCTION iinicia_require_mfa(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.iinicia_require_mfa() FROM PUBLIC;
GRANT ALL ON FUNCTION public.iinicia_require_mfa() TO anon;
GRANT ALL ON FUNCTION public.iinicia_require_mfa() TO authenticated;
GRANT ALL ON FUNCTION public.iinicia_require_mfa() TO service_role;


--
-- Name: FUNCTION iinicia_review_admission(application_id uuid, reviewer_id uuid, decision public.academic_status, notes text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.iinicia_review_admission(application_id uuid, reviewer_id uuid, decision public.academic_status, notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.iinicia_review_admission(application_id uuid, reviewer_id uuid, decision public.academic_status, notes text) TO service_role;


--
-- Name: FUNCTION is_admin(target_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin(target_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.is_admin(target_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_admin(target_uid uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: TABLE admission_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.admission_applications TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.admission_applications TO authenticated;
GRANT ALL ON TABLE public.admission_applications TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE campus_access_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campus_access_logs TO anon;
GRANT ALL ON TABLE public.campus_access_logs TO authenticated;
GRANT ALL ON TABLE public.campus_access_logs TO service_role;


--
-- Name: TABLE cms_contents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cms_contents TO anon;
GRANT ALL ON TABLE public.cms_contents TO authenticated;
GRANT ALL ON TABLE public.cms_contents TO service_role;


--
-- Name: TABLE contact_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_messages TO anon;
GRANT ALL ON TABLE public.contact_messages TO authenticated;
GRANT ALL ON TABLE public.contact_messages TO service_role;


--
-- Name: TABLE course_mappings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.course_mappings TO anon;
GRANT ALL ON TABLE public.course_mappings TO authenticated;
GRANT ALL ON TABLE public.course_mappings TO service_role;


--
-- Name: TABLE enrollment_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.enrollment_requests TO anon;
GRANT ALL ON TABLE public.enrollment_requests TO authenticated;
GRANT ALL ON TABLE public.enrollment_requests TO service_role;


--
-- Name: TABLE institutional_directory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.institutional_directory TO anon;
GRANT ALL ON TABLE public.institutional_directory TO authenticated;
GRANT ALL ON TABLE public.institutional_directory TO service_role;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.permissions TO anon;
GRANT ALL ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


--
-- Name: SEQUENCE permissions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.permissions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.permissions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.permissions_id_seq TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE programs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.programs TO anon;
GRANT ALL ON TABLE public.programs TO authenticated;
GRANT ALL ON TABLE public.programs TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: SEQUENCE roles_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.roles_id_seq TO anon;
GRANT ALL ON SEQUENCE public.roles_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.roles_id_seq TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE user_programs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.user_programs TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.user_programs TO authenticated;
GRANT ALL ON TABLE public.user_programs TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE v_user_authorized_courses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.v_user_authorized_courses TO anon;
GRANT ALL ON TABLE public.v_user_authorized_courses TO authenticated;
GRANT ALL ON TABLE public.v_user_authorized_courses TO service_role;


--
-- Name: TABLE v_user_complete_profile; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.v_user_complete_profile TO anon;
GRANT ALL ON TABLE public.v_user_complete_profile TO authenticated;
GRANT ALL ON TABLE public.v_user_complete_profile TO service_role;


--
-- Name: TABLE wp_migration_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wp_migration_inventory TO anon;
GRANT ALL ON TABLE public.wp_migration_inventory TO authenticated;
GRANT ALL ON TABLE public.wp_migration_inventory TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role; END IF; END $$;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role; END IF; END $$;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role; END IF; END $$;


--
-- PostgreSQL database dump complete
--



--
-- Trigger en auth.users para inicializacion de perfiles en el portal
--
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;


--
-- Configuracion de hook pre-request para AAL2 en PostgREST (Data API)
--
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.iinicia_require_mfa';
  END IF;
END $$;

COMMIT;
