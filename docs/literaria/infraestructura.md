# Datos, contratos e infraestructura

Las migraciones establecen permisos y datos en orden cronológico. Docker conecta los servicios y OpenAPI publica el contrato de la API. El generador permite volver a crear los archivos a partir de estos capítulos.

## database

Archivos de este componente y su configuración.

### database/001_initial_user_tables.sql

<!-- archivo: database/001_initial_user_tables.sql -->
```sql
-- IINICIA Portal · base PostgreSQL · 001_initial_user_tables.sql
begin;

-- 1. Catálogo de roles
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),

  constraint roles_code_format
    check (code ~ '^[a-z][a-z0-9_]*$')
);

insert into public.roles (code, name)
values
  ('admin',       'Administrador'),
  ('coordinator', 'Coordinador'),
  ('teacher',     'Profesor'),
  ('student',     'Estudiante'),
  ('applicant',   'Aspirante')
on conflict (code) do update
set name = excluded.name;


-- 2. Perfil complementario a auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  status text not null default 'pending',
  moodle_user_id bigint unique,
  created_at timestamptz not null default now(),

  constraint profiles_status_allowed
    check (status in ('pending', 'active', 'suspended'))
);


-- 3. Relación usuarios-roles: permite varios roles por usuario
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,

  primary key (user_id, role_id)
);


-- 4. Crear perfil y asignar el rol inicial a cada usuario nuevo
-- No se toma el rol desde los metadatos del cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- 5. Activar RLS
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;


-- 6. Permisos iniciales: el usuario autenticado solo consulta
-- sus datos y el catálogo de roles.
revoke all on public.profiles from anon, authenticated;
revoke all on public.roles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone)
  on public.profiles to authenticated;

grant select on public.roles to authenticated;
grant select on public.user_roles to authenticated;


-- 7. Políticas RLS
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can update allowed fields on their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Authenticated users can read roles"
on public.roles
for select
to authenticated
using (true);

create policy "Users can read their own role assignments"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

commit;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'roles', 'user_roles')
order by table_name;

--------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'roles', 'user_roles')
order by table_name;

select code, name
from public.roles
order by code;

select
  p.id,
  p.first_name,
  p.last_name,
  p.status,
  r.code as role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
left join public.roles r on r.id = ur.role_id
order by p.created_at desc;
```

## docker

La configuración local conecta los servicios con una red interna y publica sus puertos hacia la máquina de desarrollo.

### docker/compose.yaml

<!-- archivo: docker/compose.yaml -->
```yaml
# IINICIA Portal · despliegue local · compose.yaml
name: iinicia

services:
  # ==============================================================================
  # BASE DE DATOS POSTGRESQL (Supabase / IINICIA)
  # ==============================================================================
  db:
    image: postgres:16-alpine
    container_name: iinicia-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-postgres}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - iinicia_pgdata:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d:ro
      - ../supabase/migrations/20261116120000_staff_scope.sql:/docker-entrypoint-initdb.d/04-staff-scope.sql:ro
      - ../supabase/migrations/20261120120000_limit_client_privileges.sql:/docker-entrypoint-initdb.d/05-limit-client-privileges.sql:ro
    ports:
      - "127.0.0.1:${DB_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - iinicia-net

  # ==============================================================================
  # SUPABASE AUTH (GoTrue)
  # ==============================================================================
  auth:
    image: supabase/gotrue:v2.197.0
    container_name: iinicia-auth
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      GOTRUE_JWT_SECRET: ${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_DB_DRIVER: postgres
      DATABASE_URL: postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-postgres}?sslmode=disable
      API_EXTERNAL_URL: ${AUTH_EXTERNAL_URL:-http://localhost:9999}
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_SITE_URL: ${FRONTEND_URL:-http://localhost:4000}
      GOTRUE_URI_ALLOW_LIST: ${URI_ALLOW_LIST:-http://localhost:4000,http://127.0.0.1:4000,http://localhost:4000/*,http://192.168.191.171:4007/*}
      GOTRUE_MAILER_AUTOCONFIRM: ${MAILER_AUTOCONFIRM:-false}
      GOTRUE_SMTP_HOST: mailpit
      GOTRUE_SMTP_PORT: 1025
      GOTRUE_SMTP_ADMIN_EMAIL: noreply@iinicia.org
      GOTRUE_SMTP_SENDER_NAME: "IINICIA Portal"
    ports:
      - "127.0.0.1:${AUTH_PORT:-9999}:9999"
    networks:
      - iinicia-net

  # ==============================================================================
  # DATA API (PostgREST)
  # ==============================================================================
  rest:
    image: postgrest/postgrest:v14.6
    container_name: iinicia-rest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-postgres}
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
      PGRST_DB_PRE_REQUEST: public.iinicia_require_mfa
    ports:
      - "127.0.0.1:${REST_PORT:-3001}:3000"
    networks:
      - iinicia-net

  # ==============================================================================
  # SERVICIO DE CORREO LOCAL (Mailpit)
  # ==============================================================================
  mailpit:
    image: axllent/mailpit:latest
    container_name: iinicia-mail
    restart: unless-stopped
    ports:
      - "127.0.0.1:${MAILPIT_UI_PORT:-8025}:8025"
      - "127.0.0.1:${MAILPIT_SMTP_PORT:-1025}:1025"
    networks:
      - iinicia-net

  # ==============================================================================
  # BACKEND API (NestJS)
  # ==============================================================================
  api:
    build:
      context: ../apps/api
      dockerfile: Dockerfile
    container_name: iinicia-api
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      auth:
        condition: service_started
    environment:
      PORT: 3000
      NODE_ENV: production
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:4000,http://127.0.0.1:4000,http://192.168.191.171:4007}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:4000}
      SUPABASE_URL: ${API_SUPABASE_URL:-http://auth:9999}
      SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder}
      SUPABASE_SECRET_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder}
      MOODLE_URL: ${MOODLE_URL:-http://host.docker.internal/moodle}
      MOODLE_BASE_URL: ${MOODLE_BASE_URL:-http://host.docker.internal/moodle}
      MOODLE_WS_TOKEN: ${MOODLE_WS_TOKEN:-your_moodle_token}
      MOODLE_ROLE_STUDENT_ID: ${MOODLE_ROLE_STUDENT_ID:-5}
      MOODLE_ROLE_TEACHER_ID: ${MOODLE_ROLE_TEACHER_ID:-3}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:${API_PORT:-3000}:3000"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - iinicia-net

  # ==============================================================================
  # FRONTEND PORTAL (Next.js 16)
  # ==============================================================================
  web:
    build:
      context: ../apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3000/api/v1}
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:9999}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder}
        NEXT_PUBLIC_MOODLE_URL: ${NEXT_PUBLIC_MOODLE_URL:-http://localhost/moodle}
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}
    container_name: iinicia-web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_started
    ports:
      - "127.0.0.1:${WEB_PORT:-4000}:4000"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4000/"]
      interval: 20s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks:
      - iinicia-net

  # ==============================================================================
  # MOODLE LMS CONTAINERIZADO (Opcional mediante perfil 'full-lms')
  # Para instalaciones que no cuentan con Moodle nativo en el servidor host
  # ==============================================================================
  moodle-db:
    profiles: ["full-lms"]
    image: bitnami/mariadb:11.4
    container_name: iinicia-moodle-db
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: ${MOODLE_DB_PASSWORD:-iinicia_moodle_secret}
      MARIADB_DATABASE: bitnami_moodle
      MARIADB_USER: bn_moodle
      MARIADB_PASSWORD: ${MOODLE_DB_PASSWORD:-iinicia_moodle_secret}
      MARIADB_CHARACTER_SET: utf8mb4
      MARIADB_COLLATE: utf8mb4_unicode_ci
    volumes:
      - moodle_db_data:/bitnami/mariadb
    networks:
      - iinicia-net

  moodle:
    profiles: ["full-lms"]
    image: bitnami/moodle:4.5
    container_name: iinicia-moodle
    restart: unless-stopped
    depends_on:
      - moodle-db
    environment:
      MOODLE_DATABASE_HOST: moodle-db
      MOODLE_DATABASE_PORT_NUMBER: 3306
      MOODLE_DATABASE_USER: bn_moodle
      MOODLE_DATABASE_PASSWORD: ${MOODLE_DB_PASSWORD:-iinicia_moodle_secret}
      MOODLE_DATABASE_NAME: bitnami_moodle
      MOODLE_USERNAME: ${MOODLE_ADMIN_USER:-admin}
      MOODLE_PASSWORD: ${MOODLE_ADMIN_PASSWORD:-Admin.2026!}
      MOODLE_EMAIL: ${MOODLE_ADMIN_EMAIL:-admin@iinicia.org}
    volumes:
      - moodle_data:/bitnami/moodle
      - moodledata_data:/bitnami/moodledata
    ports:
      - "127.0.0.1:${MOODLE_PORT:-8080}:8080"
    networks:
      - iinicia-net

volumes:
  iinicia_pgdata:
  moodle_db_data:
  moodle_data:
  moodledata_data:

networks:
  iinicia-net:
    driver: bridge

```

### docker/init-db/00-roles.sql

<!-- archivo: docker/init-db/00-roles.sql -->
```sql
-- IINICIA Portal · despliegue local · 00-roles.sql
-- =================================================================================
-- Inicialización de roles estándar de Supabase para PostgreSQL local
-- =================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN SUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

```

### docker/init-db/01-auth-schema.sql

<!-- archivo: docker/init-db/01-auth-schema.sql -->
```sql
--
-- PostgreSQL database dump
--

\restrict 4Dh8DdeJlJio8qcWHclBpbe6Y20U8iLja82hZAyeh905jFlRw68GvNwqIINsNfk

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO postgres;

--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO postgres;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO postgres;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO postgres;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone',
    'recovery_code'
);


ALTER TYPE auth.factor_type OWNER TO postgres;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO postgres;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO postgres;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO postgres;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO postgres;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: postgres
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO postgres;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO postgres;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;


ALTER FUNCTION auth.jwt() OWNER TO postgres;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO postgres;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;


ALTER FUNCTION auth.uid() OWNER TO postgres;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO postgres;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO postgres;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO postgres;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO postgres;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO postgres;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO postgres;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO postgres;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO postgres;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: mfa_recovery_code_sets; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.mfa_recovery_code_sets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    mfa_factor_id uuid NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    verification_locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mfa_recovery_code_sets_failed_verification_count_check CHECK ((failed_verification_count >= 0))
);


ALTER TABLE auth.mfa_recovery_code_sets OWNER TO postgres;

--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.mfa_recovery_codes (
    id uuid NOT NULL,
    mfa_recovery_code_set_id uuid NOT NULL,
    code_hash text NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.mfa_recovery_codes OWNER TO postgres;

--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO postgres;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO postgres;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO postgres;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO postgres;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO postgres;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: postgres
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO postgres;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: postgres
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO postgres;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO postgres;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.schema_migrations (
    version character varying(14) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO postgres;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: scim_tokens; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.scim_tokens (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    token_hash text NOT NULL,
    prefix text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    CONSTRAINT scim_tokens_expires_at_future CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT scim_tokens_revoked_after_created CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT scim_tokens_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


ALTER TABLE auth.scim_tokens OWNER TO postgres;

--
-- Name: scim_users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.scim_users (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    user_id uuid,
    resource jsonb NOT NULL,
    user_name text GENERATED ALWAYS AS (lower((resource ->> 'userName'::text))) STORED NOT NULL,
    external_id text GENERATED ALWAYS AS ((resource ->> 'externalId'::text)) STORED,
    active boolean GENERATED ALWAYS AS (COALESCE(((resource ->> 'active'::text))::boolean, true)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE auth.scim_users OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO postgres;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO postgres;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO postgres;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO postgres;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_key UNIQUE (mfa_factor_id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_key UNIQUE (user_id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: scim_tokens scim_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_pkey PRIMARY KEY (id);


--
-- Name: scim_users scim_users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: mfa_recovery_codes_set_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX mfa_recovery_codes_set_id_idx ON auth.mfa_recovery_codes USING btree (mfa_recovery_code_set_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: schema_migrations_version_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX schema_migrations_version_idx ON auth.schema_migrations USING btree (version);


--
-- Name: scim_tokens_expires_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_tokens_expires_at_idx ON auth.scim_tokens USING btree (expires_at);


--
-- Name: scim_tokens_revoked_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_tokens_revoked_at_idx ON auth.scim_tokens USING btree (revoked_at);


--
-- Name: scim_tokens_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_tokens_sso_provider_id_idx ON auth.scim_tokens USING btree (sso_provider_id);


--
-- Name: scim_tokens_token_hash_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX scim_tokens_token_hash_key ON auth.scim_tokens USING btree (token_hash);


--
-- Name: scim_users_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_created_at_idx ON auth.scim_users USING btree (sso_provider_id, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_deleted_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_deleted_at_idx ON auth.scim_users USING btree (deleted_at);


--
-- Name: scim_users_external_id_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX scim_users_external_id_key ON auth.scim_users USING btree (sso_provider_id, external_id) WHERE ((external_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: scim_users_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_id_idx ON auth.scim_users USING btree (sso_provider_id, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_sso_provider_id_idx ON auth.scim_users USING btree (sso_provider_id);


--
-- Name: scim_users_updated_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_updated_at_idx ON auth.scim_users USING btree (sso_provider_id, updated_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_user_id_idx ON auth.scim_users USING btree (user_id);


--
-- Name: scim_users_user_name_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX scim_users_user_name_idx ON auth.scim_users USING btree (sso_provider_id, user_name COLLATE "C", id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_name_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX scim_users_user_name_key ON auth.scim_users USING btree (sso_provider_id, user_name) WHERE (deleted_at IS NULL);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: postgres
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: postgres
--



--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_fkey FOREIGN KEY (mfa_factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_codes mfa_recovery_codes_mfa_recovery_code_set_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_mfa_recovery_code_set_id_fkey FOREIGN KEY (mfa_recovery_code_set_id) REFERENCES auth.mfa_recovery_code_sets(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_tokens scim_tokens_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: postgres
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.audit_log_entries FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.flow_state FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.identities FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.instances FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.mfa_amr_claims FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.mfa_challenges FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.mfa_factors FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.one_time_tokens FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.refresh_tokens FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.saml_providers FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.saml_relay_states FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.schema_migrations FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.schema_migrations TO postgres;
GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.sessions FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.sso_domains FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.sso_providers FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: postgres
--

REVOKE ALL ON TABLE auth.users FROM postgres;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict 4Dh8DdeJlJio8qcWHclBpbe6Y20U8iLja82hZAyeh905jFlRw68GvNwqIINsNfk


```

### docker/init-db/02-baseline.sql

<!-- archivo: docker/init-db/02-baseline.sql -->
```sql
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

```

### docker/init-db/03-seed.sql

<!-- archivo: docker/init-db/03-seed.sql -->
```sql
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

```

## docs

Archivos de este componente y su configuración.

### docs/openapi.json

Publica el contrato HTTP en un formato que pueden leer generadores de clientes y documentación.

<!-- archivo: docs/openapi.json -->
```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "IINICIA API",
    "version": "1.0.0",
    "description": "API REST oficial de la Plataforma Digital Universitaria IINICIA (NestJS + Supabase + Moodle). Gestiona la identidad con Supabase Auth, roles RBAC, oferta acad\u00e9mica, solicitudes de admisi\u00f3n, matr\u00edculas y sincronizaci\u00f3n bidireccional con Moodle LMS.\n"
  },
  "servers": [
    {
      "url": "http://localhost:3000/api/v1",
      "description": "Servidor de desarrollo local"
    },
    {
      "url": "http://192.168.191.171:3000/api/v1",
      "description": "Servidor de desarollo remoto"
    }
  ],
  "paths": {
    "/help-chat": {
      "post": {
        "summary": "Consultar al asistente de ayuda de IINICIA",
        "description": "Recupera entradas de la guía pública y pide a DeepSeek redactar una respuesta breve con referencias.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "question"
                ],
                "properties": {
                  "question": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  },
                  "previous_questions": {
                    "type": "array",
                    "maxItems": 3,
                    "description": "Preguntas previas para interpretar seguimientos y aclaraciones.",
                    "items": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 300
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Respuesta redactada con referencias del portal o derivación a Contacto.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "text",
                    "action",
                    "sources"
                  ],
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "action": {
                      "type": "object",
                      "required": [
                        "href",
                        "label"
                      ],
                      "properties": {
                        "href": {
                          "type": "string"
                        },
                        "label": {
                          "type": "string"
                        }
                      }
                    },
                    "sources": {
                      "type": "array",
                      "maxItems": 3,
                      "items": {
                        "type": "object",
                        "required": [
                          "href",
                          "label"
                        ],
                        "properties": {
                          "href": {
                            "type": "string"
                          },
                          "label": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Consulta inválida."
          },
          "429": {
            "description": "Límite temporal de consultas alcanzado."
          },
          "503": {
            "description": "El proveedor de IA no está configurado o no está disponible."
          }
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Verificaci\u00f3n de salud y estado de integraciones",
        "description": "Devuelve el estado del backend, de Supabase PostgreSQL y de Moodle Web Services.",
        "responses": {
          "200": {
            "description": "Estado general del sistema.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "example": "ok"
                    },
                    "timestamp": {
                      "type": "string",
                      "format": "date-time"
                    },
                    "services": {
                      "type": "object"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/auth/login": {
      "post": {
        "summary": "Iniciar la verificaci\u00f3n en dos pasos",
        "description": "Valida la contrase\u00f1a y devuelve una continuaci\u00f3n AAL1 para configurar o verificar TOTP. La sesi\u00f3n del portal se obtiene en /auth/mfa/verify.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "password": {
                    "type": "string"
                  },
                  "captcha_token": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 2048,
                    "description": "Obligatorio cuando CAPTCHA est\u00e1 habilitado en Supabase Auth."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Continuaci\u00f3n de MFA. La respuesta no se debe almacenar.",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/MfaSetup"
                    },
                    {
                      "$ref": "#/components/schemas/MfaVerification"
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "description": "Credenciales incorrectas o correo sin confirmar."
          },
          "403": {
            "description": "La cuenta ya usa un factor que el portal no admite."
          },
          "429": {
            "description": "L\u00edmite de intentos alcanzado."
          },
          "503": {
            "description": "Servicio de autenticaci\u00f3n o MFA no disponible."
          },
          "400": {
            "description": "Datos inv\u00e1lidos o CAPTCHA rechazado."
          }
        }
      }
    },
    "/auth/register": {
      "post": {
        "summary": "Registro de nuevo aspirante / usuario",
        "description": "Inicia el registro p\u00fablico en Supabase Auth. El usuario debe confirmar su correo antes de iniciar sesi\u00f3n. El trigger de base de datos aprovisiona el perfil inicial de aspirante.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password",
                  "first_name",
                  "last_name"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "password": {
                    "type": "string",
                    "minLength": 8
                  },
                  "first_name": {
                    "type": "string"
                  },
                  "last_name": {
                    "type": "string"
                  },
                  "phone": {
                    "type": "string"
                  },
                  "captcha_token": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 2048,
                    "description": "Obligatorio cuando CAPTCHA est\u00e1 habilitado en Supabase Auth."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Solicitud recibida. Devuelve un mensaje sin credenciales de sesi\u00f3n.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "message"
                  ],
                  "properties": {
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Datos inv\u00e1lidos o CAPTCHA rechazado."
          },
          "429": {
            "description": "L\u00edmite de solicitudes alcanzado."
          },
          "503": {
            "description": "Supabase Auth o la confirmaci\u00f3n por correo no est\u00e1n disponibles."
          }
        }
      }
    },
    "/auth/me": {
      "get": {
        "summary": "Identidad del usuario autenticado",
        "description": "Devuelve el perfil institucional, roles activos, permisos consolidados y estado de Moodle. Requiere una sesi\u00f3n AAL2, igual que el resto de operaciones protegidas del portal.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Perfil y permisos del usuario autenticado.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MeResponse"
                }
              }
            }
          },
          "401": {
            "description": "Token no v\u00e1lido o cuenta suspendida."
          },
          "403": {
            "description": "La sesi\u00f3n a\u00fan no ha completado la verificaci\u00f3n en dos pasos."
          }
        }
      }
    },
    "/users": {
      "get": {
        "summary": "Listado paginado y filtrado de usuarios",
        "description": "Consulta usuarios con soporte para b\u00fasqueda difusa, filtro por estado o rol. Requiere permiso users.read.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "query",
            "name": "search",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "status",
            "schema": {
              "type": "string",
              "enum": [
                "pendiente",
                "activo",
                "suspendido",
                "inactivo",
                "baja"
              ]
            }
          },
          {
            "in": "query",
            "name": "role",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer",
              "default": 20
            }
          },
          {
            "in": "query",
            "name": "offset",
            "schema": {
              "type": "integer",
              "default": 0
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Listado paginado de usuarios."
          }
        }
      },
      "post": {
        "summary": "Creaci\u00f3n administrativa de usuario con asignaci\u00f3n directa de rol",
        "description": "Permite al personal administrativo crear una cuenta con un rol espec\u00edfico (estudiante, profesor, coordinador, etc.) y sincronizarla opcionalmente con Moodle de forma inmediata sin suplantar la sesi\u00f3n del administrador.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password",
                  "first_name",
                  "last_name",
                  "role_id"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "password": {
                    "type": "string",
                    "minLength": 8
                  },
                  "first_name": {
                    "type": "string"
                  },
                  "last_name": {
                    "type": "string"
                  },
                  "phone": {
                    "type": "string"
                  },
                  "role_id": {
                    "type": "integer",
                    "description": "Identificador num\u00e9rico del rol en Supabase (ej. 3=coordinador, 4=profesor, 5=estudiante)."
                  },
                  "sync_to_moodle": {
                    "type": "boolean",
                    "default": false,
                    "description": "Si es true, aprovisiona la cuenta inmediatamente en Moodle LMS v\u00eda Web Services."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Usuario creado y rol asignado exitosamente."
          },
          "400": {
            "description": "Datos de entrada inv\u00e1lidos o correo ya registrado."
          },
          "403": {
            "description": "No posees permisos para crear usuarios administrativos (requiere users.manage)."
          }
        }
      }
    },
    "/users/{id}": {
      "get": {
        "summary": "Detalle consolidado de usuario",
        "description": "Devuelve datos completos de perfil, roles y programas. Los estudiantes solo ven su propio perfil.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Detalle del usuario."
          },
          "403": {
            "description": "Acceso no autorizado al perfil de otro usuario."
          }
        }
      }
    },
    "/users/{id}/status": {
      "patch": {
        "summary": "Cambiar estado de usuario (activar, suspender, baja)",
        "description": "Actualiza el estado administrativo y sincroniza suspensi\u00f3n en Moodle. Requiere permiso users.manage.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "status"
                ],
                "properties": {
                  "status": {
                    "type": "string",
                    "enum": [
                      "pendiente",
                      "activo",
                      "suspendido",
                      "inactivo",
                      "baja"
                    ]
                  },
                  "reason": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Estado actualizado exitosamente."
          }
        }
      }
    },
    "/users/me/profile": {
      "patch": {
        "summary": "Actualizar perfil propio",
        "description": "Actualiza campos editables propios (nombre, apellidos, tel\u00e9fono, avatar, bio) bajo RLS.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "first_name": {
                    "type": "string"
                  },
                  "last_name": {
                    "type": "string"
                  },
                  "phone": {
                    "type": "string"
                  },
                  "avatar_url": {
                    "type": "string"
                  },
                  "bio": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Perfil actualizado."
          }
        }
      }
    },
    "/roles": {
      "get": {
        "summary": "Cat\u00e1logo de roles",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de roles del sistema."
          }
        }
      }
    },
    "/roles/users/{userId}": {
      "post": {
        "summary": "Asignar rol a usuario",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "userId",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "role_id"
                ],
                "properties": {
                  "role_id": {
                    "type": "integer"
                  },
                  "expires_at": {
                    "type": "string",
                    "format": "date-time"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Rol asignado."
          }
        }
      }
    },
    "/roles/users/{userId}/{roleId}": {
      "delete": {
        "summary": "Revocar rol de usuario",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "userId",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "in": "path",
            "name": "roleId",
            "required": true,
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Rol revocado."
          }
        }
      }
    },
    "/permissions": {
      "get": {
        "summary": "Cat\u00e1logo de permisos del sistema",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de permisos granulares."
          }
        }
      }
    },
    "/programs": {
      "get": {
        "summary": "Cat\u00e1logo de programas acad\u00e9micos",
        "description": "Consulta p\u00fablica de programas activos; administradores pueden visualizar inactivos.",
        "responses": {
          "200": {
            "description": "Lista de programas."
          }
        }
      },
      "post": {
        "summary": "Crear nuevo programa",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Programa creado."
          }
        }
      }
    },
    "/programs/{idOrSlug}": {
      "get": {
        "summary": "Detalle de programa por ID o Slug",
        "parameters": [
          {
            "in": "path",
            "name": "idOrSlug",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Detalle del programa."
          }
        }
      }
    },
    "/programs/{id}/enroll-user": {
      "post": {
        "summary": "Vincular usuario a programa acad\u00e9mico",
        "description": "Coordinación requiere una asociación activa con el programa.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Usuario vinculado a programa."
          },
          "403": {
            "description": "Programa fuera del ámbito del usuario."
          }
        }
      }
    },
    "/courses/offerings": {
      "get": {
        "summary": "Cat\u00e1logo de cursos ofertados para asignaci\u00f3n y matr\u00edcula",
        "description": "Auto-sincroniza en segundo plano cualquier nuevo curso creado en Moodle y retorna la lista completa de course_mappings con su programa asociado.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de cursos disponibles para asignaci\u00f3n."
          }
        }
      }
    },
    "/courses/sync-moodle": {
      "post": {
        "summary": "Sincronizaci\u00f3n bajo demanda de cursos desde Moodle hacia Supabase",
        "description": "Escanea Moodle LMS (core_course_get_courses), importa nuevos cursos omitiendo el sitio y genera autom\u00e1ticamente los registros correspondientes en course_mappings y programs.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Resumen de cursos detectados e importados.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "total": {
                      "type": "integer"
                    },
                    "imported": {
                      "type": "integer"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/courses": {
      "get": {
        "summary": "Cursos accesibles para el usuario o cat\u00e1logo para staff",
        "description": "Los estudiantes y profesores \u00fanicamente ven cursos donde tienen matr\u00edcula autorizada (CA-11, CA-12, CA-13).",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de cursos correspondientes."
          }
        }
      },
      "post": {
        "summary": "Crear mapeo entre curso portal y curso Moodle",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Mapeo creado."
          }
        }
      }
    },
    "/courses/{id}": {
      "get": {
        "summary": "Detalle de curso mapeado",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Detalle del curso."
          }
        }
      }
    },
    "/enrollments": {
      "get": {
        "summary": "Consultar solicitudes de inscripci\u00f3n",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de solicitudes."
          }
        },
        "description": "Coordinaci\u00f3n ve sus solicitudes propias y las de cursos de sus programas asignados."
      },
      "post": {
        "summary": "Solicitar inscripci\u00f3n o asignar un curso",
        "description": "Las solicitudes propias quedan pendientes como estudiante. La asignaci\u00f3n a otra cuenta requiere el permiso enrollments.authorize y acceso al \u00e1mbito del curso.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "course_mapping_id"
                ],
                "properties": {
                  "course_mapping_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "user_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Cuenta destinataria en asignaciones administrativas."
                  },
                  "program_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Si se proporciona, debe coincidir con el programa del curso."
                  },
                  "moodle_role": {
                    "type": "string",
                    "enum": [
                      "student",
                      "editingteacher",
                      "teacher"
                    ],
                    "default": "student"
                  },
                  "notes": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Solicitud pendiente o asignaci\u00f3n administrativa registrada. El estado sincronizada indica confirmaci\u00f3n de Moodle."
          },
          "403": {
            "description": "Rol, permiso o \u00e1mbito insuficiente para la operaci\u00f3n."
          },
          "409": {
            "description": "Ya existe una matr\u00edcula activa o el registro cambi\u00f3 durante la solicitud."
          }
        }
      }
    },
    "/enrollments/{id}": {
      "delete": {
        "summary": "Desasignar curso o dar de baja matr\u00edcula",
        "description": "Permite cancelar una matr\u00edcula propia. Administraci\u00f3n puede revocar matr\u00edculas de otras cuentas y coordinaci\u00f3n puede hacerlo en los cursos de sus programas asignados.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "description": "Identificador UUID de la matr\u00edcula",
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Matr\u00edcula revocada y desasignada exitosamente en el portal y en Moodle LMS.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "403": {
            "description": "No autorizado para dar de baja esta matr\u00edcula."
          },
          "404": {
            "description": "Matr\u00edcula no encontrada."
          }
        }
      }
    },
    "/enrollments/{id}/status": {
      "patch": {
        "summary": "Autorizar o rechazar inscripci\u00f3n",
        "description": "Requiere permiso enrollments.authorize. Si se autoriza, puede sincronizar autom\u00e1ticamente con Moodle.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "status"
                ],
                "properties": {
                  "status": {
                    "type": "string",
                    "enum": [
                      "autorizada",
                      "rechazada",
                      "pendiente",
                      "desmatriculada"
                    ]
                  },
                  "notes": {
                    "type": "string"
                  },
                  "sync_to_moodle": {
                    "type": "boolean",
                    "default": true
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Inscripci\u00f3n actualizada."
          }
        }
      }
    },
    "/enrollments/{id}/sync": {
      "post": {
        "summary": "Sincronizar matr\u00edcula individual con Moodle",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Matr\u00edcula sincronizada con Moodle."
          }
        }
      }
    },
    "/admissions": {
      "get": {
        "summary": "Consultar solicitudes de admisi\u00f3n",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Solicitudes de admisi\u00f3n."
          }
        },
        "description": "Administraci\u00f3n consulta todas, coordinaci\u00f3n las de sus programas activos y los dem\u00e1s usuarios solo las propias."
      },
      "post": {
        "summary": "Postularse a un programa acad\u00e9mico (Aspirantes)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Postulaci\u00f3n registrada."
          }
        }
      }
    },
    "/admissions/{id}/review": {
      "patch": {
        "summary": "Dictaminar postulaci\u00f3n (admitir, rechazar)",
        "description": "Solicitudes de admisi\u00f3n.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Postulaci\u00f3n dictaminada."
          },
          "403": {
            "description": "Cuenta revisora sin autorizaci\u00f3n o fuera de \u00e1mbito."
          },
          "404": {
            "description": "Postulaci\u00f3n inexistente."
          },
          "409": {
            "description": "El dictamen requiere una revisi\u00f3n administrativa o un proceso de baja."
          }
        }
      }
    },
    "/contact": {
      "post": {
        "summary": "Enviar mensaje de contacto",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "full_name",
                  "email",
                  "subject",
                  "message"
                ],
                "properties": {
                  "full_name": {
                    "type": "string"
                  },
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "phone": {
                    "type": "string"
                  },
                  "subject": {
                    "type": "string"
                  },
                  "program_of_interest": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "message": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Mensaje recibido."
          },
          "429": {
            "description": "Límite de solicitudes del formulario alcanzado. Reintenta más tarde."
          }
        }
      }
    },
    "/moodle/status": {
      "get": {
        "summary": "Estado de conexi\u00f3n con Moodle Web Services",
        "responses": {
          "200": {
            "description": "Estado del servicio Moodle."
          }
        }
      }
    },
    "/moodle/sync/user/{userId}": {
      "post": {
        "summary": "Sincronizar o crear usuario en Moodle evitando duplicados",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "userId",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Usuario sincronizado en Moodle."
          }
        }
      }
    },
    "/moodle/sync/users": {
      "post": {
        "summary": "Sincronizaci\u00f3n masiva de todos los usuarios no vinculados con Moodle",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Resumen de sincronizaci\u00f3n por lotes.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "total": {
                      "type": "integer"
                    },
                    "synced": {
                      "type": "integer"
                    },
                    "failed": {
                      "type": "integer"
                    },
                    "results": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/moodle/sync/enrollment/{enrollmentId}": {
      "post": {
        "summary": "Sincronizar matr\u00edcula autorizada en Moodle",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "enrollmentId",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Matr\u00edcula sincronizada."
          },
          "403": {
            "description": "La matr\u00edcula corresponde a un curso fuera del \u00e1mbito autorizado."
          }
        },
        "description": "Coordinaci\u00f3n solo puede sincronizar matr\u00edculas de cursos en sus programas asignados."
      }
    },
    "/moodle/launch": {
      "post": {
        "summary": "Salto directo con SSO al campus general de Moodle",
        "description": "Genera una URL de acceso directo de un solo uso para ingresar a la portada del campus virtual sin pedir credenciales.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Enlace de acceso autorizado mediante token ef\u00edmero al campus.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "access_url": {
                      "type": "string",
                      "example": "http://localhost/moodle/auth/userkey/login.php?key=123abc456&wantsurl=http://localhost/moodle/"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "No autenticado."
          }
        }
      }
    },
    "/moodle/courses/{courseMappingId}/launch": {
      "post": {
        "summary": "Salto seguro al curso de Moodle desde el portal (Mi IINICIA)",
        "description": "Valida matr\u00edcula autorizada, registra en campus_access_logs y devuelve la URL del curso en Moodle.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "courseMappingId",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Enlace de acceso autorizado al campus Moodle."
          },
          "403": {
            "description": "Usuario sin matr\u00edcula autorizada en el curso."
          }
        }
      }
    },
    "/moodle/courses/{courseId}/contents": {
      "get": {
        "summary": "Estructura de temas, secciones y m\u00f3dulos de un curso",
        "description": "Obtiene los recursos y actividades configuradas en Moodle LMS (core_course_get_contents). Requiere que el usuario est\u00e9 matriculado activamente en el curso o pertenezca al personal de supervisi\u00f3n/staff. Coordinaci\u00f3n puede supervisar los cursos de sus programas asignados.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "courseId",
            "required": true,
            "description": "Identificador num\u00e9rico del curso en Moodle (ej. 2)",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Estructura de secciones y m\u00f3dulos obtenida de Moodle."
          },
          "403": {
            "description": "No posees autorizaci\u00f3n ni matr\u00edcula activa en este curso."
          },
          "404": {
            "description": "Curso de Moodle no encontrado o no mapeado en el portal."
          }
        }
      }
    },
    "/moodle/courses/{courseId}/participants": {
      "get": {
        "summary": "Listado de participantes matriculados en un curso",
        "description": "Retorna alumnos matriculados, roles y marcas de \u00faltimo acceso (core_enrol_get_enrolled_users). Exclusivo para docentes titulares del curso y personal administrativo/coordinador. Coordinaci\u00f3n puede supervisar los cursos de sus programas asignados.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "courseId",
            "required": true,
            "description": "Identificador num\u00e9rico del curso en Moodle (ej. 2)",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de participantes con estatus y accesos."
          },
          "403": {
            "description": "Acceso restringido. Se requieren privilegios docentes o administrativos en este curso."
          }
        }
      }
    },
    "/moodle/courses/{courseId}/progress": {
      "get": {
        "summary": "Progreso, actividades y calificaciones de un usuario en un curso",
        "description": "Consulta calificaciones oficiales (gradereport_user_get_grade_items) y estado de compleci\u00f3n (core_completion_get_course_completion_status). Los estudiantes solo pueden consultar su propio progreso. Docentes y administradores pueden auditar el progreso de otros alumnos pasando el par\u00e1metro moodle_user_id. Coordinaci\u00f3n puede supervisar los cursos de sus programas asignados.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "courseId",
            "required": true,
            "description": "Identificador num\u00e9rico del curso en Moodle",
            "schema": {
              "type": "integer"
            }
          },
          {
            "in": "query",
            "name": "moodle_user_id",
            "required": false,
            "description": "ID de usuario en Moodle (opcional para estudiantes, se autocompleta con su perfil).",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Resumen de avance, calificaci\u00f3n ponderada y desglose de actividades evaluadas."
          },
          "403": {
            "description": "No posees autorizaci\u00f3n para consultar el avance de otro estudiante."
          }
        }
      }
    },
    "/moodle/courses/{courseId}/teacher-overview": {
      "get": {
        "summary": "Resumen anal\u00edtico global de curso para docentes y administradores",
        "description": "Consolida el total de alumnos matriculados, profesores, m\u00f3dulos interactivos, secciones y listas de estudiantes con fecha de \u00faltima visita. Coordinaci\u00f3n puede supervisar los cursos de sus programas asignados.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "courseId",
            "required": true,
            "description": "Identificador num\u00e9rico del curso en Moodle",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Resumen anal\u00edtico integral del aula virtual."
          },
          "403": {
            "description": "Acceso restringido a docentes o coordinadores del curso."
          }
        }
      }
    },
    "/audit": {
      "get": {
        "summary": "Bit\u00e1cora inmutable de auditor\u00eda",
        "description": "Requiere permiso audit.logs.read o rol administrador.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Registros de auditor\u00eda con paginaci\u00f3n."
          }
        }
      }
    },
    "/cms/contents": {
      "get": {
        "summary": "Contenidos institucionales (noticias, p\u00e1ginas, avisos)",
        "parameters": [
          {
            "in": "query",
            "name": "type",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Lista de contenidos p\u00fablicos."
          }
        }
      }
    },
    "/cms/contents/{slug}": {
      "get": {
        "summary": "Contenido institucional por slug (Misi\u00f3n, Visi\u00f3n, Modelo Educativo)",
        "parameters": [
          {
            "in": "path",
            "name": "slug",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Contenido p\u00fablico."
          }
        }
      }
    },
    "/directory": {
      "get": {
        "summary": "Directorio institucional de autoridades y docentes",
        "responses": {
          "200": {
            "description": "Miembros del directorio."
          }
        }
      }
    },
    "/migration/redirects": {
      "get": {
        "summary": "Mapa de redirecciones 301/302 para migraci\u00f3n desde WordPress",
        "description": "Consumido por el middleware de Next.js para preservar SEO de las URLs hist\u00f3ricas.",
        "responses": {
          "200": {
            "description": "Lista de mapeos de redirecci\u00f3n."
          }
        }
      }
    },
    "/auth/recover": {
      "post": {
        "summary": "Solicitar un correo de recuperaci\u00f3n",
        "description": "Responde con el mismo mensaje para cualquier correo v\u00e1lido. El desaf\u00edo S256 habilita el enlace est\u00e1ndar PKCE.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email",
                    "maxLength": 254
                  },
                  "code_challenge": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_-]{43}$"
                  },
                  "captcha_token": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 2048,
                    "description": "Obligatorio cuando CAPTCHA est\u00e1 habilitado en Supabase Auth."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Solicitud recibida.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "message"
                  ],
                  "properties": {
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Datos inv\u00e1lidos o CAPTCHA rechazado."
          },
          "429": {
            "description": "L\u00edmite de solicitudes alcanzado."
          }
        }
      }
    },
    "/auth/reset-password": {
      "post": {
        "summary": "Restablecer contrase\u00f1a con el token de un solo uso",
        "description": "Acepta un token de plantilla personalizada o el c\u00f3digo PKCE con su verificador. Si la cuenta tiene TOTP, solicita confirmaci\u00f3n en /auth/mfa/recover antes de cambiar la contrase\u00f1a.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "password"
                ],
                "oneOf": [
                  {
                    "required": [
                      "token_hash"
                    ],
                    "not": {
                      "anyOf": [
                        {
                          "required": [
                            "auth_code"
                          ]
                        },
                        {
                          "required": [
                            "code_verifier"
                          ]
                        }
                      ]
                    }
                  },
                  {
                    "required": [
                      "auth_code",
                      "code_verifier"
                    ],
                    "not": {
                      "required": [
                        "token_hash"
                      ]
                    }
                  }
                ],
                "properties": {
                  "token_hash": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_-]{16,256}$"
                  },
                  "auth_code": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "code_verifier": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_-]{43}$"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "minLength": 8,
                    "maxLength": 72,
                    "description": "Debe ocupar como m\u00e1ximo 72 bytes en UTF-8."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Contrase\u00f1a actualizada o verificaci\u00f3n TOTP requerida.",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/AuthMessage"
                    },
                    {
                      "$ref": "#/components/schemas/MfaVerification"
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Datos inv\u00e1lidos, token caducado o contrase\u00f1a rechazada."
          },
          "403": {
            "description": "La cuenta usa un factor que el portal no admite."
          },
          "429": {
            "description": "L\u00edmite de solicitudes alcanzado."
          },
          "503": {
            "description": "El servicio de recuperaci\u00f3n no pudo completar la operaci\u00f3n."
          }
        }
      }
    },
    "/auth/mfa/verify": {
      "post": {
        "summary": "Completar el inicio de sesi\u00f3n con el c\u00f3digo del autenticador",
        "description": "Env\u00eda mfa_token como Bearer. Supabase valida el desaf\u00edo y devuelve una sesi\u00f3n AAL2.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaCode"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Sesi\u00f3n del portal verificada. La respuesta no se debe almacenar en cach\u00e9.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/VerifiedSession"
                }
              }
            }
          },
          "400": {
            "description": "Cuerpo inv\u00e1lido o c\u00f3digo incorrecto."
          },
          "401": {
            "description": "Continuaci\u00f3n ausente, inv\u00e1lida o caducada."
          },
          "403": {
            "description": "Autenticador no disponible para la cuenta."
          },
          "429": {
            "description": "L\u00edmite de intentos alcanzado."
          },
          "503": {
            "description": "Servicio de verificaci\u00f3n no disponible."
          }
        }
      }
    },
    "/auth/mfa/recover": {
      "post": {
        "summary": "Confirmar con TOTP un cambio de contrase\u00f1a iniciado por correo",
        "description": "Env\u00eda como Bearer el mfa_token devuelto por /auth/reset-password. No se devuelve una sesi\u00f3n del portal.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "factor_id",
                  "code",
                  "password"
                ],
                "properties": {
                  "factor_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "code": {
                    "type": "string",
                    "pattern": "^[0-9]{6}$"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "minLength": 8,
                    "maxLength": 72
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Contrase\u00f1a actualizada.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthMessage"
                }
              }
            }
          },
          "400": {
            "description": "Cuerpo inv\u00e1lido, c\u00f3digo incorrecto o contrase\u00f1a rechazada."
          },
          "401": {
            "description": "Continuaci\u00f3n de recuperaci\u00f3n ausente, inv\u00e1lida o caducada."
          },
          "403": {
            "description": "Autenticador no disponible para la cuenta."
          },
          "429": {
            "description": "L\u00edmite de intentos alcanzado."
          },
          "503": {
            "description": "Servicio de recuperaci\u00f3n o MFA no disponible."
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "schemas": {
      "MeResponse": {
        "type": "object",
        "required": [
          "id",
          "email",
          "first_name",
          "last_name",
          "status",
          "roles",
          "permissions"
        ],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "first_name": {
            "type": "string"
          },
          "last_name": {
            "type": "string"
          },
          "phone": {
            "type": "string",
            "nullable": true
          },
          "avatar_url": {
            "type": "string",
            "nullable": true
          },
          "status": {
            "type": "string",
            "enum": [
              "pendiente",
              "activo",
              "suspendido",
              "inactivo",
              "baja"
            ]
          },
          "roles": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "estudiante"
            ]
          },
          "permissions": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "campus.access"
            ]
          },
          "moodle_user_id": {
            "type": "integer",
            "nullable": true
          },
          "moodle_username": {
            "type": "string",
            "nullable": true
          },
          "moodle_sync_status": {
            "type": "string",
            "enum": [
              "no_vinculado",
              "pendiente",
              "sincronizado",
              "error",
              "suspendido_en_moodle"
            ]
          }
        }
      },
      "MfaSetup": {
        "type": "object",
        "required": [
          "step",
          "mfa_token",
          "factor_id",
          "secret"
        ],
        "properties": {
          "step": {
            "type": "string",
            "enum": [
              "setup"
            ]
          },
          "mfa_token": {
            "type": "string",
            "description": "JWT temporal AAL1 para continuar la verificaci\u00f3n."
          },
          "factor_id": {
            "type": "string",
            "format": "uuid"
          },
          "secret": {
            "type": "string",
            "description": "Clave de configuraci\u00f3n manual del autenticador."
          },
          "qr_code": {
            "type": "string",
            "description": "Imagen QR como URL de datos SVG codificada en Base64."
          }
        }
      },
      "MfaVerification": {
        "type": "object",
        "required": [
          "step",
          "mfa_token",
          "factors"
        ],
        "properties": {
          "step": {
            "type": "string",
            "enum": [
              "verify"
            ]
          },
          "mfa_token": {
            "type": "string",
            "description": "JWT temporal AAL1 para continuar la verificaci\u00f3n."
          },
          "factors": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": [
                "id"
              ],
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid"
                },
                "name": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      "MfaCode": {
        "type": "object",
        "required": [
          "factor_id",
          "code"
        ],
        "properties": {
          "factor_id": {
            "type": "string",
            "format": "uuid"
          },
          "code": {
            "type": "string",
            "pattern": "^[0-9]{6}$"
          }
        }
      },
      "VerifiedSession": {
        "type": "object",
        "required": [
          "access_token",
          "refresh_token",
          "token_type",
          "expires_in",
          "user"
        ],
        "properties": {
          "access_token": {
            "type": "string",
            "description": "JWT AAL2 validado por Supabase Auth."
          },
          "refresh_token": {
            "type": "string"
          },
          "token_type": {
            "type": "string",
            "enum": [
              "bearer"
            ]
          },
          "expires_in": {
            "type": "integer"
          },
          "expires_at": {
            "type": "integer"
          },
          "user": {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "email": {
                "type": "string",
                "format": "email"
              }
            }
          }
        }
      },
      "AuthMessage": {
        "type": "object",
        "required": [
          "message"
        ],
        "properties": {
          "message": {
            "type": "string"
          }
        }
      }
    }
  }
}

```

### docs/openapi.yaml

<!-- archivo: docs/openapi.yaml -->
```yaml
# IINICIA Portal · contrato HTTP · openapi.yaml
# Contrato HTTP de la API. Las rutas documentan el método, los datos de entrada y las respuestas que consumen el portal y las pruebas.
openapi: 3.0.3
info:
  title: IINICIA API
  version: 1.0.0
  description: >
    API REST oficial de la Plataforma Digital Universitaria IINICIA (NestJS + Supabase + Moodle).
    Gestiona la identidad con Supabase Auth, roles RBAC, oferta académica, solicitudes de admisión,
    matrículas y sincronización bidireccional con Moodle LMS.
servers:
  - url: http://localhost:3000/api/v1
    description: Servidor de desarrollo local
  - url: http://192.168.191.171:3000/api/v1
    description: Servidor de desarollo remoto

paths:
  /help-chat:
    post:
      summary: Consultar al asistente de ayuda de IINICIA
      description: Recupera entradas de la guía pública y pide a DeepSeek redactar una respuesta breve con referencias.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [question]
              properties:
                question:
                  type: string
                  minLength: 1
                  maxLength: 300
                previous_questions:
                  type: array
                  maxItems: 3
                  description: Preguntas previas para interpretar seguimientos y aclaraciones.
                  items:
                    type: string
                    minLength: 1
                    maxLength: 300
      responses:
        "200":
          description: Respuesta redactada con referencias del portal o derivación a Contacto.
          content:
            application/json:
              schema:
                type: object
                required: [text, action, sources]
                properties:
                  text:
                    type: string
                  action:
                    type: object
                    required: [href, label]
                    properties:
                      href:
                        type: string
                      label:
                        type: string
                  sources:
                    type: array
                    maxItems: 3
                    items:
                      type: object
                      required: [href, label]
                      properties:
                        href:
                          type: string
                        label:
                          type: string
        "400":
          description: Consulta inválida.
        "429":
          description: Límite temporal de consultas alcanzado.
        "503":
          description: El proveedor de IA no está configurado o no está disponible.

  # =========================================================================
  # SALUD
  # =========================================================================
  /health:
    get:
      summary: Verificación de salud y estado de integraciones
      description: Devuelve el estado del backend, de Supabase PostgreSQL y de Moodle Web Services.
      responses:
        "200":
          description: Estado general del sistema.
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok
                  timestamp:
                    type: string
                    format: date-time
                  services:
                    type: object

  # =========================================================================
  # AUTENTICACIÓN
  # =========================================================================
  /auth/login:
    post:
      summary: Iniciar la verificación en dos pasos
      description: Valida la contraseña y devuelve una continuación AAL1 para configurar o verificar TOTP. La sesión del portal se obtiene en /auth/mfa/verify.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                captcha_token:
                  type: string
                  minLength: 1
                  maxLength: 2048
                  description: Obligatorio cuando CAPTCHA está habilitado en Supabase Auth.
                email:
                  type: string
                  format: email
                password:
                  type: string
      responses:
        "400":
          description: Datos inválidos o CAPTCHA rechazado.
        "200":
          description: Continuación de MFA. La respuesta no se debe almacenar.
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/MfaSetup'
                  - $ref: '#/components/schemas/MfaVerification'
        "401":
          description: Credenciales incorrectas o correo sin confirmar.
        "403":
          description: La cuenta ya usa un factor que el portal no admite.
        "429":
          description: Límite de intentos alcanzado.
        "503":
          description: Servicio de autenticación o MFA no disponible.

  /auth/mfa/verify:
    post:
      summary: Completar el inicio de sesión con el código del autenticador
      description: Envía mfa_token como Bearer. Supabase valida el desafío y devuelve una sesión AAL2.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MfaCode'
      responses:
        "200":
          description: Sesión del portal verificada. La respuesta no se debe almacenar en caché.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VerifiedSession'
        "400":
          description: Cuerpo inválido o código incorrecto.
        "401":
          description: Continuación ausente, inválida o caducada.
        "403":
          description: Autenticador no disponible para la cuenta.
        "429":
          description: Límite de intentos alcanzado.
        "503":
          description: Servicio de verificación no disponible.

  /auth/mfa/recover:
    post:
      summary: Confirmar con TOTP un cambio de contraseña iniciado por correo
      description: Envía como Bearer el mfa_token devuelto por /auth/reset-password. No se devuelve una sesión del portal.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [factor_id, code, password]
              properties:
                factor_id:
                  type: string
                  format: uuid
                code:
                  type: string
                  pattern: '^[0-9]{6}$'
                password:
                  type: string
                  format: password
                  minLength: 8
                  maxLength: 72
      responses:
        "200":
          description: Contraseña actualizada.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthMessage'
        "400":
          description: Cuerpo inválido, código incorrecto o contraseña rechazada.
        "401":
          description: Continuación de recuperación ausente, inválida o caducada.
        "403":
          description: Autenticador no disponible para la cuenta.
        "429":
          description: Límite de intentos alcanzado.
        "503":
          description: Servicio de recuperación o MFA no disponible.

  # Registro y recuperación usan Origin validado contra FRONTEND_URL/CORS_ORIGIN.
  # Supabase también requiere las URLs de retorno en su lista de redirecciones.
  /auth/register:
    post:
      summary: Registro de nuevo aspirante / usuario
      description: Inicia el registro público en Supabase Auth. El usuario debe confirmar su correo antes de iniciar sesión. El trigger de base de datos aprovisiona el perfil inicial de aspirante.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, first_name, last_name]
              properties:
                captcha_token:
                  type: string
                  minLength: 1
                  maxLength: 2048
                  description: Obligatorio cuando CAPTCHA está habilitado en Supabase Auth.
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                first_name:
                  type: string
                last_name:
                  type: string
                phone:
                  type: string
      responses:
        "201":
          description: Solicitud recibida. Devuelve un mensaje sin credenciales de sesión.
          content:
            application/json:
              schema:
                type: object
                required: [message]
                properties:
                  message:
                    type: string
        "400":
          description: Datos inválidos o contraseña rechazada. CAPTCHA rechazado cuando está habilitado.
        "429":
          description: Límite de solicitudes alcanzado.
        "503":
          description: Supabase Auth o la confirmación por correo no están disponibles.

  /auth/recover:
    post:
      summary: Solicitar un correo de recuperación
      description: Responde con el mismo mensaje para cualquier correo válido. El desafío S256 habilita el enlace estándar PKCE.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                captcha_token:
                  type: string
                  minLength: 1
                  maxLength: 2048
                  description: Obligatorio cuando CAPTCHA está habilitado en Supabase Auth.
                email:
                  type: string
                  format: email
                  maxLength: 254
                code_challenge:
                  type: string
                  pattern: '^[A-Za-z0-9_-]{43}$'
      responses:
        "200":
          description: Solicitud recibida.
          content:
            application/json:
              schema:
                type: object
                required: [message]
                properties:
                  message:
                    type: string
        "400":
          description: Correo inválido. CAPTCHA rechazado cuando está habilitado.
        "429":
          description: Límite de solicitudes alcanzado.
  /auth/reset-password:
    post:
      summary: Restablecer contraseña con el token de un solo uso
      description: Acepta un token de plantilla personalizada o el código PKCE con su verificador. Si la cuenta tiene TOTP, solicita confirmación en /auth/mfa/recover antes de cambiar la contraseña.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password]
              oneOf:
                - required: [token_hash]
                  not:
                    anyOf:
                      - required: [auth_code]
                      - required: [code_verifier]
                - required: [auth_code, code_verifier]
                  not:
                    required: [token_hash]
              properties:
                token_hash:
                  type: string
                  pattern: '^[A-Za-z0-9_-]{16,256}$'
                auth_code:
                  type: string
                  format: uuid
                code_verifier:
                  type: string
                  pattern: '^[A-Za-z0-9_-]{43}$'
                password:
                  type: string
                  format: password
                  minLength: 8
                  maxLength: 72
                  description: Debe ocupar como máximo 72 bytes en UTF-8.
      responses:
        "200":
          description: Contraseña actualizada o verificación TOTP requerida.
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/AuthMessage'
                  - $ref: '#/components/schemas/MfaVerification'
        "400":
          description: Datos inválidos, token caducado o contraseña rechazada.
        "403":
          description: La cuenta usa un factor que el portal no admite.
        "429":
          description: Límite de solicitudes alcanzado.
        "503":
          description: El servicio de recuperación no pudo completar la operación.

  /auth/me:
    get:
      summary: Identidad del usuario autenticado
      description: Devuelve el perfil institucional, roles activos, permisos consolidados y estado de Moodle. Requiere una sesión AAL2, igual que el resto de operaciones protegidas del portal.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Perfil y permisos del usuario autenticado.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MeResponse"
        "401":
          description: Token no válido o cuenta suspendida.
        "403":
          description: La sesión aún no ha completado la verificación en dos pasos.

  # =========================================================================
  # USUARIOS Y PERFILES
  # =========================================================================
  /users:
    get:
      summary: Listado paginado y filtrado de usuarios
      description: Consulta usuarios con soporte para búsqueda difusa, filtro por estado o rol. Requiere permiso users.read.
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: search
          schema:
            type: string
        - in: query
          name: status
          schema:
            type: string
            enum: [pendiente, activo, suspendido, inactivo, baja]
        - in: query
          name: role
          schema:
            type: string
        - in: query
          name: limit
          schema:
            type: integer
            default: 20
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
      responses:
        "200":
          description: Listado paginado de usuarios.

    post:
      summary: Creación administrativa de usuario con asignación directa de rol
      description: Permite al personal administrativo crear una cuenta con un rol específico (estudiante, profesor, coordinador, etc.) y sincronizarla opcionalmente con Moodle de forma inmediata sin suplantar la sesión del administrador.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, first_name, last_name, role_id]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                first_name:
                  type: string
                last_name:
                  type: string
                phone:
                  type: string
                role_id:
                  type: integer
                  description: Identificador numérico del rol en Supabase (ej. 3=coordinador, 4=profesor, 5=estudiante).
                sync_to_moodle:
                  type: boolean
                  default: false
                  description: Si es true, aprovisiona la cuenta inmediatamente en Moodle LMS vía Web Services.
      responses:
        "201":
          description: Usuario creado y rol asignado exitosamente.
        "400":
          description: Datos de entrada inválidos o correo ya registrado.
        "403":
          description: No posees permisos para crear usuarios administrativos (requiere users.manage).

  /users/{id}:
    get:
      summary: Detalle consolidado de usuario
      description: Devuelve datos completos de perfil, roles y programas. Los estudiantes solo ven su propio perfil.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Detalle del usuario.
        "403":
          description: Acceso no autorizado al perfil de otro usuario.

  /users/{id}/status:
    patch:
      summary: Cambiar estado de usuario (activar, suspender, baja)
      description: Actualiza el estado administrativo y sincroniza suspensión en Moodle. Requiere permiso users.manage.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                  enum: [pendiente, activo, suspendido, inactivo, baja]
                reason:
                  type: string
      responses:
        "200":
          description: Estado actualizado exitosamente.

  /users/me/profile:
    patch:
      summary: Actualizar perfil propio
      description: Actualiza campos editables propios (nombre, apellidos, teléfono, avatar, bio) bajo RLS.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                first_name:
                  type: string
                last_name:
                  type: string
                phone:
                  type: string
                avatar_url:
                  type: string
                bio:
                  type: string
      responses:
        "200":
          description: Perfil actualizado.

  # =========================================================================
  # ROLES Y PERMISOS
  # =========================================================================
  /roles:
    get:
      summary: Catálogo de roles
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Lista de roles del sistema.

  /roles/users/{userId}:
    post:
      summary: Asignar rol a usuario
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: userId
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [role_id]
              properties:
                role_id:
                  type: integer
                expires_at:
                  type: string
                  format: date-time
      responses:
        "201":
          description: Rol asignado.

  /roles/users/{userId}/{roleId}:
    delete:
      summary: Revocar rol de usuario
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: userId
          required: true
          schema:
            type: string
            format: uuid
        - in: path
          name: roleId
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Rol revocado.

  /permissions:
    get:
      summary: Catálogo de permisos del sistema
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Lista de permisos granulares.

  # =========================================================================
  # OFERTA ACADÉMICA Y PROGRAMAS
  # =========================================================================
  /programs:
    get:
      summary: Catálogo de programas académicos
      description: Consulta pública de programas activos; administradores pueden visualizar inactivos.
      responses:
        "200":
          description: Lista de programas.
    post:
      summary: Crear nuevo programa
      security:
        - bearerAuth: []
      responses:
        "201":
          description: Programa creado.

  /programs/{idOrSlug}:
    get:
      summary: Detalle de programa por ID o Slug
      parameters:
        - in: path
          name: idOrSlug
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Detalle del programa.

  /programs/{id}/enroll-user:
    post:
      summary: Vincular usuario a programa académico
      description: Coordinación requiere una asociación activa con el programa.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Usuario vinculado a programa.
        "403":
          description: Programa fuera del ámbito del usuario.

  # =========================================================================
  # CURSOS Y MAPEOS CON MOODLE
  # =========================================================================
  /courses/offerings:
    get:
      summary: Catálogo de cursos ofertados para asignación y matrícula
      description: Consulta los cursos activos bajo JWT y RLS para solicitar acceso. No importa cursos ni concede matrícula. El catálogo administrativo se consulta en GET /courses; coordinación queda limitada a sus programas.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Lista de cursos disponibles para asignación.

  /courses/sync-moodle:
    post:
      summary: Sincronización bajo demanda de cursos desde Moodle hacia Supabase
      description: Escanea Moodle LMS (core_course_get_courses), importa nuevos cursos omitiendo el sitio y genera automáticamente los registros correspondientes en course_mappings y programs.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Resumen de cursos detectados e importados.
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  imported:
                    type: integer

  /courses:
    get:
      summary: Cursos accesibles para el usuario o catálogo para staff
      description: Los estudiantes y profesores únicamente ven cursos donde tienen matrícula autorizada (CA-11, CA-12, CA-13).
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Lista de cursos correspondientes.
    post:
      summary: Crear mapeo entre curso portal y curso Moodle
      security:
        - bearerAuth: []
      responses:
        "201":
          description: Mapeo creado.

  /courses/{id}:
    get:
      summary: Detalle de curso mapeado
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Detalle del curso.

  # =========================================================================
  # INSCRIPCIONES Y MATRÍCULAS
  # =========================================================================
  /enrollments:
    get:
      summary: Consultar solicitudes de inscripción
      description: Coordinación ve sus solicitudes propias y las de cursos de sus programas asignados.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Lista de solicitudes.
    post:
      summary: Solicitar inscripción o asignar un curso
      description: Las solicitudes propias quedan pendientes como estudiante. La asignación a otra cuenta requiere el permiso enrollments.authorize y acceso al ámbito del curso.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [course_mapping_id]
              properties:
                course_mapping_id:
                  type: string
                  format: uuid
                user_id:
                  type: string
                  format: uuid
                  description: Cuenta destinataria en asignaciones administrativas.
                program_id:
                  type: string
                  format: uuid
                  description: Si se proporciona, debe coincidir con el programa del curso.
                moodle_role:
                  type: string
                  enum: [student, editingteacher, teacher]
                  default: student
                notes:
                  type: string
      responses:
        "201":
          description: Solicitud pendiente o asignación administrativa registrada. El estado sincronizada indica confirmación de Moodle.
        "403":
          description: Rol, permiso o ámbito insuficiente para la operación.
        "409":
          description: Ya existe una matrícula activa o el registro cambió durante la solicitud.

  /enrollments/{id}:
    delete:
      summary: Desasignar curso o dar de baja matrícula
      description: Permite cancelar una matrícula propia. Administración puede revocar matrículas de otras cuentas y coordinación puede hacerlo en los cursos de sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          description: Identificador UUID de la matrícula
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Matrícula revocada y desasignada exitosamente en el portal y en Moodle LMS.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
        "403":
          description: No autorizado para dar de baja esta matrícula.
        "404":
          description: Matrícula no encontrada.

  /enrollments/{id}/status:
    patch:
      summary: Autorizar o rechazar inscripción
      description: Requiere permiso enrollments.authorize. Si se autoriza, puede sincronizar automáticamente con Moodle.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                  enum: [autorizada, rechazada, pendiente, desmatriculada]
                notes:
                  type: string
                sync_to_moodle:
                  type: boolean
                  default: true
      responses:
        "200":
          description: Inscripción actualizada.

  /enrollments/{id}/sync:
    post:
      summary: Sincronizar matrícula individual con Moodle
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Matrícula sincronizada con Moodle.

  # =========================================================================
  # ADMISIONES DE ASPIRANTES
  # =========================================================================
  /admissions:
    get:
      summary: Consultar solicitudes de admisión
      description: Administración consulta todas, coordinación las de sus programas activos y los demás usuarios solo las propias.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Solicitudes de admisión.
    post:
      summary: Postularse a un programa académico (Aspirantes)
      security:
        - bearerAuth: []
      responses:
        "201":
          description: Postulación registrada.

  /admissions/{id}/review:
    patch:
      summary: Dictaminar postulación (admitir, rechazar)
      description: Confirma en una transacción el dictamen, la auditoría y, al admitir, el programa, perfil y rol Estudiante. Coordinación requiere ámbito sobre el programa. Requiere admissions.review, salvo superadministración.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Postulación dictaminada. Al admitir, incluye enrollment_summary con total, synced y state (synced, no_courses o incomplete) para los cursos iniciales.
        "403":
          description: Cuenta revisora sin autorización o fuera de ámbito.
        "404":
          description: Postulación inexistente.
        "409":
          description: El dictamen requiere una revisión administrativa o un proceso de baja.

  /contact:
    post:
      summary: Enviar un mensaje desde el formulario público de contacto
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [full_name, email, subject, message]
              properties:
                full_name:
                  type: string
                  maxLength: 150
                email:
                  type: string
                  format: email
                  maxLength: 254
                phone:
                  type: string
                  maxLength: 20
                subject:
                  type: string
                  maxLength: 200
                program_of_interest:
                  type: string
                  format: uuid
                message:
                  type: string
                  maxLength: 3000
      responses:
        "201":
          description: Mensaje registrado.
          content:
            application/json:
              schema:
                type: object
                required: [success, message_id, submitted_at]
                properties:
                  success:
                    type: boolean
                    example: true
                  message_id:
                    type: string
                    format: uuid
                  submitted_at:
                    type: string
                    format: date-time
        "400":
          description: Datos de contacto inválidos.
        "429":
          description: Límite de solicitudes del formulario alcanzado. Reintenta más tarde.
        "500":
          description: No fue posible registrar el mensaje.

  # =========================================================================
  # MOODLE WEB SERVICES & CAMPUS SSO
  # =========================================================================
  /moodle/status:
    get:
      summary: Estado de conexión con Moodle Web Services
      responses:
        "200":
          description: Estado del servicio Moodle.

  /moodle/sync/user/{userId}:
    post:
      summary: Sincronizar o crear usuario en Moodle evitando duplicados
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: userId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Usuario sincronizado en Moodle.

  /moodle/sync/users:
    post:
      summary: Sincronización masiva de todos los usuarios no vinculados con Moodle
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Resumen de sincronización por lotes.
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  synced:
                    type: integer
                  failed:
                    type: integer
                  results:
                    type: array
                    items:
                      type: object

  /moodle/sync/enrollment/{enrollmentId}:
    post:
      summary: Sincronizar matrícula autorizada en Moodle
      description: Coordinación solo puede sincronizar matrículas de cursos en sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: enrollmentId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Matrícula sincronizada.
        "403":
          description: La matrícula corresponde a un curso fuera del ámbito autorizado.

  /moodle/launch:
    post:
      summary: Salto directo con SSO al campus general de Moodle
      description: Genera una URL de acceso directo de un solo uso para ingresar a la portada del campus virtual sin pedir credenciales.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Enlace de acceso autorizado mediante token efímero al campus.
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_url:
                    type: string
                    example: "http://localhost/moodle/auth/userkey/login.php?key=123abc456&wantsurl=http://localhost/moodle/"
        "401":
          description: No autenticado.

  /moodle/courses/{courseMappingId}/launch:
    post:
      summary: Salto seguro al curso de Moodle desde el portal (Mi IINICIA)
      description: Valida matrícula autorizada, registra en campus_access_logs y devuelve la URL del curso en Moodle.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseMappingId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Enlace de acceso autorizado al campus Moodle.
        "403":
          description: Usuario sin matrícula autorizada en el curso.

  /moodle/courses/{courseMappingId}/launch-gradebook:
    post:
      summary: Abrir el calificador de Moodle mediante SSO
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseMappingId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Enlace al calificador del curso asignado.
        "403":
          description: No hay una matrícula docente sincronizada para ese curso.

  /moodle/courses/{courseId}/contents:
    get:
      summary: Estructura de temas, secciones y módulos de un curso
      description: Obtiene los recursos y actividades configuradas en Moodle LMS (core_course_get_contents). Requiere que el usuario esté matriculado activamente en el curso o pertenezca al personal de supervisión/staff. Coordinación puede supervisar los cursos de sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseId
          required: true
          description: Identificador numérico del curso en Moodle (ej. 2)
          schema:
            type: integer
      responses:
        "200":
          description: Estructura de secciones y módulos obtenida de Moodle.
        "403":
          description: No posees autorización ni matrícula activa en este curso.
        "404":
          description: Curso de Moodle no encontrado o no mapeado en el portal.

  /moodle/courses/{courseId}/participants:
    get:
      summary: Listado de participantes matriculados en un curso
      description: Retorna alumnos matriculados, roles y marcas de último acceso (core_enrol_get_enrolled_users). Exclusivo para docentes titulares del curso y personal administrativo/coordinador. Coordinación puede supervisar los cursos de sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseId
          required: true
          description: Identificador numérico del curso en Moodle (ej. 2)
          schema:
            type: integer
      responses:
        "200":
          description: Lista de participantes con estatus y accesos.
        "403":
          description: Acceso restringido. Se requieren privilegios docentes o administrativos en este curso.

  /moodle/courses/{courseId}/progress:
    get:
      summary: Progreso, actividades y calificaciones de un usuario en un curso
      description: Consulta calificaciones oficiales (gradereport_user_get_grade_items) y estado de compleción (core_completion_get_course_completion_status). Los estudiantes solo pueden consultar su propio progreso. Docentes y administradores pueden auditar el progreso de otros alumnos pasando el parámetro moodle_user_id. Coordinación puede supervisar los cursos de sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseId
          required: true
          description: Identificador numérico del curso en Moodle
          schema:
            type: integer
        - in: query
          name: moodle_user_id
          required: false
          description: ID de usuario en Moodle (opcional para estudiantes, se autocompleta con su perfil).
          schema:
            type: integer
      responses:
        "200":
          description: Progreso de finalización de Moodle y calificaciones del usuario. `percentage` se conserva por compatibilidad como campo heredado de calificación.
          content:
            application/json:
              schema:
                type: object
                properties:
                  course_id:
                    type: integer
                  moodle_user_id:
                    type: integer
                  total_modules:
                    type: integer
                  grade_raw:
                    type: number
                    nullable: true
                  grade_formatted:
                    type: string
                  percentage:
                    type: number
                    deprecated: true
                    description: Campo heredado del porcentaje de calificación; usar grade_percentage.
                  grade_percentage:
                    type: number
                    nullable: true
                    description: Porcentaje de la calificación final en Moodle, no representa avance del curso.
                  progress_percentage:
                    type: number
                    nullable: true
                    minimum: 0
                    maximum: 100
                    description: Porcentaje de finalización del curso calculado por Moodle; null si no hay datos de progreso.
                  completed_activities:
                    type: integer
                    minimum: 0
                    description: Actividades rastreadas que Moodle considera completadas.
                  total_tracked_activities:
                    type: integer
                    minimum: 0
                    description: Actividades visibles con seguimiento de finalización habilitado.
                  is_completed:
                    type: boolean
                  completion_status:
                    type: object
                    nullable: true
                    additionalProperties: true
                  grade_items:
                    type: array
                    items:
                      type: object
                      additionalProperties: true
        "403":
          description: No posees autorización para consultar el avance de otro estudiante.

  /moodle/courses/{courseId}/teacher-overview:
    get:
      summary: Resumen analítico global de curso para docentes y administradores
      description: Consolida el total de alumnos matriculados, profesores, módulos interactivos, secciones y listas de estudiantes con fecha de última visita. Coordinación puede supervisar los cursos de sus programas asignados.
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: courseId
          required: true
          description: Identificador numérico del curso en Moodle
          schema:
            type: integer
      responses:
        "200":
          description: Resumen analítico integral del aula virtual.
        "403":
          description: Acceso restringido a docentes o coordinadores del curso.

  # =========================================================================
  # AUDITORÍA
  # =========================================================================
  /audit:
    get:
      summary: Bitácora inmutable de auditoría
      description: Requiere permiso audit.logs.read o rol administrador.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Registros de auditoría con paginación.

  # =========================================================================
  # CMS, CONTACTO Y REDIRECCIONES WORDPRESS
  # =========================================================================
  /cms/contents:
    get:
      summary: Contenidos institucionales (noticias, páginas, avisos)
      parameters:
        - in: query
          name: type
          schema:
            type: string
      responses:
        "200":
          description: Lista de contenidos públicos.

  /cms/contents/{slug}:
    get:
      summary: Contenido institucional por slug (Misión, Visión, Modelo Educativo)
      parameters:
        - in: path
          name: slug
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Contenido público.

  /directory:
    get:
      summary: Directorio institucional de autoridades y docentes
      responses:
        "200":
          description: Miembros del directorio.

  /migration/redirects:
    get:
      summary: Mapa de redirecciones 301/302 para migración desde WordPress
      description: Consumido por el middleware de Next.js para preservar SEO de las URLs históricas.
      responses:
        "200":
          description: Lista de mapeos de redirección activos para preservación de SEO.
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    legacy_url:
                      type: string
                      example: "/?page_id=1172"
                    new_target_url:
                      type: string
                      example: "/universidad"
                    http_redirect_code:
                      type: integer
                      example: 301

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    MfaSetup:
      type: object
      required: [step, mfa_token, factor_id, secret]
      properties:
        step:
          type: string
          enum: [setup]
        mfa_token:
          type: string
          description: JWT temporal AAL1 para continuar la verificación.
        factor_id:
          type: string
          format: uuid
        secret:
          type: string
          description: Clave de configuración manual del autenticador.
        qr_code:
          type: string
          description: Imagen QR como URL de datos SVG codificada en Base64.
    MfaVerification:
      type: object
      required: [step, mfa_token, factors]
      properties:
        step:
          type: string
          enum: [verify]
        mfa_token:
          type: string
          description: JWT temporal AAL1 para continuar la verificación.
        factors:
          type: array
          minItems: 1
          items:
            type: object
            required: [id]
            properties:
              id:
                type: string
                format: uuid
              name:
                type: string
    MfaCode:
      type: object
      required: [factor_id, code]
      properties:
        factor_id:
          type: string
          format: uuid
        code:
          type: string
          pattern: '^[0-9]{6}$'
    VerifiedSession:
      type: object
      required: [access_token, refresh_token, token_type, expires_in, user]
      properties:
        access_token:
          type: string
          description: JWT AAL2 validado por Supabase Auth.
        refresh_token:
          type: string
        token_type:
          type: string
          enum: [bearer]
        expires_in:
          type: integer
        expires_at:
          type: integer
        user:
          type: object
          required: [id]
          properties:
            id:
              type: string
              format: uuid
            email:
              type: string
              format: email
    AuthMessage:
      type: object
      required: [message]
      properties:
        message:
          type: string
    MeResponse:
      type: object
      required:
        - id
        - email
        - first_name
        - last_name
        - status
        - roles
        - permissions
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        first_name:
          type: string
        last_name:
          type: string
        phone:
          type: string
          nullable: true
        avatar_url:
          type: string
          nullable: true
        status:
          type: string
          enum: [pendiente, activo, suspendido, inactivo, baja]
        roles:
          type: array
          items:
            type: string
          example: ["estudiante"]
        permissions:
          type: array
          items:
            type: string
          example: ["campus.access"]
        moodle_user_id:
          type: integer
          nullable: true
        moodle_username:
          type: string
          nullable: true
        moodle_sync_status:
          type: string
          enum: [no_vinculado, pendiente, sincronizado, error, suspendido_en_moodle]

```

## scripts

Archivos de este componente y su configuración.

### scripts/literate.mjs

<!-- archivo: scripts/literate.mjs -->
```javascript
// IINICIA Portal · herramientas del proyecto · literate.mjs
/** Cada bloque del capítulo corresponde a un archivo. La extracción aplica las mismas reglas de rutas que la generación y escribe en un directorio nuevo. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'docs', 'literaria');
const types = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', css: 'css', sql: 'sql', json: 'json',
  yaml: 'yaml', yml: 'yaml', svg: 'xml',
};
const volumes = [
  ['api', 'API y pruebas', 'La petición pasa primero por validación y permisos. A continuación se ejecuta la lógica de negocio y se invoca la integración necesaria.', (name) => name.startsWith('apps/api/')],
  ['web', 'Portal y pruebas', 'Las páginas componen la interfaz. Las bibliotecas compartidas documentan el contrato con la API y las reglas para tratar datos y enlaces.', (name) => name.startsWith('apps/web/')],
  ['infraestructura', 'Datos, contratos e infraestructura', 'Las migraciones establecen permisos y datos en orden cronológico. Docker conecta los servicios y OpenAPI publica el contrato de la API. El generador permite volver a crear los archivos a partir de estos capítulos.', () => true],
];
const narrative = {
  'apps/api/src/common': 'Los guards y clientes compartidos resuelven la identidad, verifican el alcance del rol y conservan los permisos de la sesión al consultar Supabase.',
  'apps/api/src/modules': 'Los controladores definen las entradas HTTP. Sus servicios aplican reglas de negocio y delegan a los clientes externos.',
  'apps/api/src/modules/auth': 'El ingreso, la recuperación y el segundo factor construyen una sesión antes de acceder a operaciones protegidas.',
  'apps/api/src/modules/users': 'Los perfiles identifican a las personas. Las operaciones de administración requieren el permiso correspondiente y dejan constancia en la bitácora.',
  'apps/api/src/modules/admissions': 'Una persona aspirante solicita acceso a un programa. El dictamen revisa la autorización de quien decide y actualiza el estado académico.',
  'apps/api/src/modules/enrollments': 'La solicitud y la autorización de una matrícula tienen estados distintos. La API registra la sincronización con el campus después del resultado de Moodle.',
  'apps/api/src/modules/help-chat': 'El asistente busca texto de ayuda, valida las respuestas y obtiene sus enlaces a partir de las fuentes internas.',
  'apps/api/src/modules/moodle': 'El servicio traduce la identidad y el ámbito del portal a operaciones del campus. El cliente limita los destinos y envía las credenciales por el canal configurado.',
  'apps/api/src/modules/health': 'Los diagnósticos públicos conservan el estado de las integraciones con mensajes genéricos para los errores de la base de datos.',
  'apps/web/src/app': 'El enrutador de Next.js carga las vistas públicas y los paneles. La API decide los permisos de los recursos protegidos.',
  'apps/web/src/lib': 'Las bibliotecas centralizan solicitudes y reglas de navegación, incluyendo la validación del destino de Moodle.',
  'apps/web/src/contexts': 'Los contextos comparten sesión y preferencias de interfaz entre las páginas.',
  'apps/web/src/components': 'Los componentes construyen formularios, navegación y paneles a partir de las respuestas del portal.',
  'apps/web/test': 'Las pruebas unitarias llaman directamente a las funciones de la aplicación y ejercitan las decisiones de navegación con datos de prueba.',
  'supabase/migrations': 'Los archivos se aplican por fecha. Las políticas de PostgreSQL limitan la lectura por sesión y rol incluso cuando la consulta llega directamente a la API de datos.',
  'supabase/tests': 'Las pruebas verifican privilegios y acceso por rol en una base de ensayo.',
  'docker': 'La configuración local conecta los servicios con una red interna y publica sus puertos hacia la máquina de desarrollo.',
};

// JSON no admite comentarios. La explicación se publica junto al bloque que se puede reconstruir.
const jsonContext = {
  'apps/api/.oxlintrc.json': 'Define las reglas del análisis estático de NestJS y TypeScript.',
  'apps/api/nest-cli.json': 'Indica a la CLI dónde comienza la API y cuándo limpiar la salida de compilación.',
  'apps/api/package.json': 'Declara el entorno de módulos, las dependencias y los comandos de compilación, pruebas y despliegue de la API.',
  'apps/api/tsconfig.build.json': 'Parte de la configuración general y limita la compilación de producción al código de src.',
  'apps/api/tsconfig.json': 'Configura el compilador TypeScript de la API y la emisión del proyecto.',
  'apps/web/package.json': 'Agrupa los comandos del portal y las dependencias usadas por Next.js y las pruebas.',
  'apps/web/tsconfig.json': 'Define cómo TypeScript comprueba el portal y resuelve sus rutas de importación.',
  'docs/openapi.json': 'Publica el contrato HTTP en un formato que pueden leer generadores de clientes y documentación.',
};

/** Acota los bloques a las rutas y formatos del código propio que la herramienta puede reconstruir. */
function isSource(name) {
  if (name.includes('..') || !/^[\w./@-]+$/.test(name)) return false;
  if (['docs/openapi.yaml', 'docs/openapi.json'].includes(name)) return true;
  if (!/^(apps\/(api|web)|docker|database|supabase|scripts)\//.test(name)) return false;
  return !name.endsWith('/package-lock.json') &&
    (name.endsWith('/Dockerfile') || Object.hasOwn(types, name.split('.').at(-1)));
}

/** Obtiene los archivos versionados y los nuevos no ignorados para identificar el conjunto de entrada. */
function sourceFiles() {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8',
  });
  return [...new Set(paths.split('\0').filter(isSource))].sort();
}

/** Lee el archivo como texto y normaliza los finales de línea para comparar los capítulos entre plataformas. */
function readSource(name) {
  return readFileSync(join(root, name), 'utf8').replace(/\r\n/g, '\n');
}

/** Elige la explicación más específica disponible para ubicar el archivo en el capítulo correcto. */
function chapter(name) {
  const group = Object.keys(narrative).filter((prefix) => name.startsWith(prefix + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return group ?? dirname(name);
}

/** Agrupa los archivos por volumen y agrega un bloque cercado por cada fuente para mantener el contexto y la posibilidad de extraerla. */
function writeVolumes(files) {
  mkdirSync(docs, { recursive: true });
  const remaining = new Set(files);
  for (const [id, title, intro, belongs] of volumes) {
    const groups = new Map();
    for (const name of remaining) {
      if (!belongs(name)) continue;
      const section = chapter(name);
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push(name);
      remaining.delete(name);
    }
    const output = [`# ${title}\n\n${intro}\n`];
    for (const [group, names] of groups) {
      output.push(`\n## ${group}\n\n${narrative[group] ?? 'Archivos de este componente y su configuración.'}\n`);
      for (const name of names) {
        const content = readSource(name);
        const fence = '`'.repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), (run) => run[0].length + 1)));
        const language = types[name.split('.').at(-1)] ?? 'dockerfile';
        const explanation = jsonContext[name] ? `${jsonContext[name]}\n\n` : '';
        output.push(`\n### ${name}\n\n${explanation}<!-- archivo: ${name} -->\n${fence}${language}\n${content}\n${fence}\n`);
      }
    }
    writeFileSync(join(docs, id + '.md'), output.join(''), 'utf8');
  }
}

/** Valida cada marcador, el cierre y la unicidad de los bloques antes de comparar o reconstruir los archivos. */
function readVolumes() {
  const chunks = new Map();
  for (const [id] of volumes) {
    const markdown = readFileSync(join(docs, id + '.md'), 'utf8').replace(/\r\n/g, '\n');
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith('<!-- archivo: ')) continue;
      const marker = lines[i].match(/^<!-- archivo: (.+) -->$/);
      const fence = lines[i + 1]?.match(/^(`{3,})[a-z]+$/)?.[1];
      const name = marker?.[1];
      if (!name || !isSource(name) || !fence || chunks.has(name)) {
        throw new Error(`Bloque literario inválido en ${id}.md, línea ${i + 1}`);
      }
      const end = lines.indexOf(fence, i + 2);
      if (end === -1) throw new Error(`Falta cerrar el bloque de ${name}`);
      chunks.set(name, lines.slice(i + 2, end).join('\n'));
      i = end;
    }
  }
  return chunks;
}

const [command, destination] = process.argv.slice(2);
if (command === 'sync') {
  writeVolumes(sourceFiles());
} else if (command === 'verify') {
  const files = sourceFiles();
  const chunks = readVolumes();
  const changed = files.filter((name) => chunks.get(name) !== readSource(name));
  const extra = [...chunks.keys()].filter((name) => !files.includes(name));
  if (changed.length || extra.length) throw new Error(`Bloques desactualizados: ${[...changed, ...extra].join(', ')}`);
  console.log(`${chunks.size} bloques coinciden con el código fuente.`);
} else if (command === 'extract' && destination) {
  const target = resolve(destination);
  const chunks = readVolumes();
  mkdirSync(target);
  for (const [name, content] of chunks) {
    const file = join(target, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
  }
  console.log(`${chunks.size} archivos reconstruidos en ${target}.`);
} else {
  throw new Error('Uso: node scripts/literate.mjs sync | verify | extract <directorio-nuevo>');
}

```

## supabase/history

Archivos de este componente y su configuración.

### supabase/history/20261020110000_initial_schema.sql

<!-- archivo: supabase/history/20261020110000_initial_schema.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261020110000_initial_schema.sql
-- Esquema inicial de IINICIA.
-- Revisar antes de aplicar manualmente desde el SQL Editor de Supabase.
-- La credencial privilegiada de Supabase puede omitir RLS.

BEGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  deactivated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT profiles_deactivation_state_check CHECK (
    (status = 'active' AND deactivated_at IS NULL AND deactivated_by IS NULL)
    OR (status = 'inactive' AND deactivated_at IS NOT NULL AND deactivated_by IS NOT NULL)
  )
);

CREATE TABLE public.roles (
  code text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_check CHECK (
    code IN (
      'superadmin',
      'admin',
      'coordinator',
      'teacher',
      'student',
      'applicant',
      'support'
    )
  )
);

INSERT INTO public.roles (code, description)
VALUES
  ('superadmin', 'Administración global del sistema'),
  ('admin', 'Administración institucional según permisos'),
  ('coordinator', 'Operación limitada a programas asignados'),
  ('teacher', 'Docencia limitada a cursos asignados'),
  ('student', 'Acceso a programas y cursos autorizados'),
  ('applicant', 'Gestión de información y seguimiento de admisión'),
  ('support', 'Acceso operativo limitado')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  role_code text NOT NULL REFERENCES public.roles (code) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_code)
);

CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programs_code_nonempty_check CHECK (length(btrim(code)) > 0),
  CONSTRAINT programs_name_nonempty_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT programs_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.user_programs (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES public.programs (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_programs_pkey PRIMARY KEY (user_id, program_id),
  CONSTRAINT user_programs_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.course_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs (id) ON DELETE RESTRICT,
  moodle_course_id integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_mappings_moodle_course_id_check CHECK (moodle_course_id > 0),
  CONSTRAINT course_mappings_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.moodle_user_mappings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE RESTRICT,
  moodle_user_id integer UNIQUE,
  desired_status text NOT NULL DEFAULT 'active',
  sync_status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moodle_user_mappings_user_id_check CHECK (
    moodle_user_id IS NULL OR moodle_user_id > 0
  ),
  CONSTRAINT moodle_user_mappings_sync_status_check CHECK (
    sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT moodle_user_mappings_desired_status_check CHECK (
    desired_status IN ('active', 'inactive')
  ),
  CONSTRAINT moodle_user_mappings_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT moodle_user_mappings_synced_check CHECK (
    sync_status <> 'synced'
    OR (moodle_user_id IS NOT NULL AND last_synced_at IS NOT NULL)
  ),
  CONSTRAINT moodle_user_mappings_failed_error_check CHECK (
    sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  )
);

CREATE TABLE public.course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  course_mapping_id uuid NOT NULL REFERENCES public.course_mappings (id) ON DELETE RESTRICT,
  assignment_status text NOT NULL DEFAULT 'active',
  moodle_sync_status text NOT NULL DEFAULT 'pending',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_assignments_teacher_course_key UNIQUE (teacher_id, course_mapping_id),
  CONSTRAINT course_assignments_status_check CHECK (
    assignment_status IN ('active', 'revoked')
  ),
  CONSTRAINT course_assignments_sync_status_check CHECK (
    moodle_sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT course_assignments_revocation_check CHECK (
    (assignment_status = 'active' AND revoked_at IS NULL)
    OR (assignment_status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT course_assignments_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT course_assignments_synced_check CHECK (
    moodle_sync_status <> 'synced' OR last_synced_at IS NOT NULL
  ),
  CONSTRAINT course_assignments_failed_error_check CHECK (
    moodle_sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  )
);

CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  course_mapping_id uuid NOT NULL REFERENCES public.course_mappings (id) ON DELETE RESTRICT,
  decision_status text NOT NULL DEFAULT 'submitted',
  sync_status text,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  last_sync_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_requests_decision_status_check CHECK (
    decision_status IN ('submitted', 'approved', 'rejected')
  ),
  CONSTRAINT enrollment_requests_sync_status_check CHECK (
    sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed')
  ),
  CONSTRAINT enrollment_requests_review_state_check CHECK (
    (decision_status = 'submitted'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND sync_status IS NULL)
    OR (decision_status = 'approved'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND sync_status IS NOT NULL)
    OR (decision_status = 'rejected'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND sync_status IS NULL)
  ),
  CONSTRAINT enrollment_requests_synced_check CHECK (
    (sync_status = 'synced' AND synced_at IS NOT NULL)
    OR (sync_status IS DISTINCT FROM 'synced' AND synced_at IS NULL)
  ),
  CONSTRAINT enrollment_requests_failed_error_check CHECK (
    sync_status IS DISTINCT FROM 'failed'
    OR last_sync_error_code IS NOT NULL
  ),
  CONSTRAINT enrollment_requests_attempt_count_check CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX enrollment_requests_one_open_per_student_course_idx
  ON public.enrollment_requests (student_id, course_mapping_id)
  WHERE decision_status IN ('submitted', 'approved');

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action_code text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_code_nonempty_check CHECK (length(btrim(action_code)) > 0),
  CONSTRAINT audit_logs_target_type_nonempty_check CHECK (length(btrim(target_type)) > 0),
  CONSTRAINT audit_logs_target_id_nonempty_check CHECK (length(btrim(target_id)) > 0),
  CONSTRAINT audit_logs_details_object_check CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX user_roles_role_code_idx
  ON public.user_roles (role_code, user_id);
CREATE INDEX user_programs_program_status_idx
  ON public.user_programs (program_id, status, user_id);
CREATE INDEX course_mappings_program_status_idx
  ON public.course_mappings (program_id, status);
CREATE INDEX course_assignments_course_status_idx
  ON public.course_assignments (course_mapping_id, assignment_status);
CREATE INDEX course_assignments_sync_attempt_idx
  ON public.course_assignments (moodle_sync_status, last_attempt_at);
CREATE INDEX moodle_user_mappings_sync_attempt_idx
  ON public.moodle_user_mappings (sync_status, last_attempt_at);
CREATE INDEX enrollment_requests_student_created_idx
  ON public.enrollment_requests (student_id, created_at DESC);
CREATE INDEX enrollment_requests_course_states_idx
  ON public.enrollment_requests (course_mapping_id, decision_status, sync_status);
CREATE INDEX audit_logs_actor_created_idx
  ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_target_created_idx
  ON public.audit_logs (target_type, target_id, created_at DESC);

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER programs_touch_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_programs_touch_updated_at
  BEFORE UPDATE ON public.user_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER course_mappings_touch_updated_at
  BEFORE UPDATE ON public.course_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER moodle_user_mappings_touch_updated_at
  BEFORE UPDATE ON public.moodle_user_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER course_assignments_touch_updated_at
  BEFORE UPDATE ON public.course_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER enrollment_requests_touch_updated_at
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, status)
  VALUES (NEW.id, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_code, assigned_by)
  VALUES (NEW.id, 'applicant', NULL)
  ON CONFLICT (user_id, role_code) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;

CREATE TRIGGER iinicia_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.status = 'active'
  );
$$;

CREATE FUNCTION public.has_role(_role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role_code = _role_code
    );
$$;

CREATE FUNCTION public.is_coordinator_for_program(_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role('coordinator')
    AND EXISTS (
      SELECT 1
      FROM public.user_programs AS up
      JOIN public.programs AS p ON p.id = up.program_id
      WHERE up.user_id = (SELECT auth.uid())
        AND up.program_id = _program_id
        AND up.status = 'active'
        AND p.status = 'active'
    );
$$;

CREATE FUNCTION public.is_student_in_program(_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role('student')
    AND EXISTS (
      SELECT 1
      FROM public.user_programs AS up
      JOIN public.programs AS p ON p.id = up.program_id
      WHERE up.user_id = (SELECT auth.uid())
        AND up.program_id = _program_id
        AND up.status = 'active'
        AND p.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_coordinator_for_program(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_student_in_program(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator_for_program(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_in_program(uuid) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodle_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self_active
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) AND (SELECT public.is_active_user()));

CREATE POLICY roles_select_active_users
  ON public.roles FOR SELECT TO authenticated
  USING ((SELECT public.is_active_user()));

CREATE POLICY user_roles_select_self
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_active_user()));

CREATE POLICY programs_select_active_catalog
  ON public.programs FOR SELECT TO authenticated
  USING (status = 'active' AND (SELECT public.is_active_user()));

CREATE POLICY user_programs_select_self_or_coordinator_scope
  ON public.user_programs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      user_id = (SELECT auth.uid())
      OR (SELECT public.is_coordinator_for_program(program_id))
    )
  );

CREATE POLICY course_mappings_select_active_catalog
  ON public.course_mappings FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (SELECT public.is_active_user())
    AND EXISTS (
      SELECT 1
      FROM public.programs AS p
      WHERE p.id = program_id
        AND p.status = 'active'
    )
  );

CREATE POLICY course_assignments_select_authorized_scope
  ON public.course_assignments FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      (
        teacher_id = (SELECT auth.uid())
        AND assignment_status = 'active'
        AND moodle_sync_status = 'synced'
        AND (SELECT public.has_role('teacher'))
        AND EXISTS (
          SELECT 1
          FROM public.course_mappings AS cm
          WHERE cm.id = course_mapping_id
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.course_mappings AS cm
        WHERE cm.id = course_mapping_id
          AND (SELECT public.is_coordinator_for_program(cm.program_id))
      )
    )
  );

CREATE POLICY enrollment_requests_select_self_or_coordinator_scope
  ON public.enrollment_requests FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      student_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.course_mappings AS cm
        WHERE cm.id = course_mapping_id
          AND (SELECT public.is_coordinator_for_program(cm.program_id))
      )
    )
  );

CREATE POLICY enrollment_requests_insert_own_student_request
  ON public.enrollment_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND decision_status = 'submitted'
    AND sync_status IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND (SELECT public.is_active_user())
    AND (SELECT public.has_role('student'))
    AND EXISTS (
      SELECT 1
      FROM public.course_mappings AS cm
      WHERE cm.id = course_mapping_id
        AND cm.status = 'active'
        AND (SELECT public.is_student_in_program(cm.program_id))
    )
  );

CREATE POLICY audit_logs_select_admins
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_user())
    AND (
      (SELECT public.has_role('superadmin'))
      OR (SELECT public.has_role('admin'))
    )
  );

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE
  public.profiles,
  public.roles,
  public.user_roles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.moodle_user_mappings,
  public.course_assignments,
  public.enrollment_requests,
  public.audit_logs
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.profiles,
  public.roles,
  public.user_roles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.course_assignments,
  public.enrollment_requests,
  public.audit_logs
TO authenticated;

GRANT INSERT (student_id, course_mapping_id)
  ON TABLE public.enrollment_requests TO authenticated;

GRANT SELECT ON TABLE public.roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.profiles,
  public.programs,
  public.user_programs,
  public.course_mappings,
  public.moodle_user_mappings,
  public.course_assignments,
  public.enrollment_requests
TO service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.user_roles TO service_role;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

COMMENT ON TABLE public.profiles IS
  'Perfil mínimo de aplicación relacionado con Supabase Auth; baja lógica mediante status.';
COMMENT ON TABLE public.user_roles IS
  'Roles de aplicación; no deben ser asignados directamente por el cliente.';
COMMENT ON TABLE public.moodle_user_mappings IS
  'Mapeo mínimo de identidad a Moodle; nunca almacena contraseña ni token.';
COMMENT ON TABLE public.course_mappings IS
  'Referencia de cursos Moodle para una única instancia activa en la primera versión.';
COMMENT ON TABLE public.enrollment_requests IS
  'Solicitud, decisión y estado de sincronización Moodle separados.';
COMMENT ON TABLE public.audit_logs IS
  'Auditoría de operaciones sensibles; los detalles deben estar sanitizados.';

COMMIT;

```

### supabase/history/20261110120000_require_mfa_data_api.sql

<!-- archivo: supabase/history/20261110120000_require_mfa_data_api.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261110120000_require_mfa_data_api.sql
BEGIN;

-- No reemplazar controles de otro proyecto o ambiente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting AS settings
    CROSS JOIN LATERAL unnest(settings.setconfig) AS config(entry)
    WHERE settings.setrole IN (0, 'authenticator'::regrole::oid)
      AND settings.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      AND split_part(config.entry, '=', 1) = 'pgrst.db_pre_request'
      AND split_part(config.entry, '=', 2) NOT IN ('', 'public.iinicia_require_mfa')
  ) THEN
    RAISE EXCEPTION 'Ya existe pgrst.db_pre_request. Integra iinicia_require_mfa en el hook existente.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.iinicia_require_mfa()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Completa la verificación en dos pasos.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.iinicia_require_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iinicia_require_mfa() TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.iinicia_require_mfa';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

```

### supabase/history/20261113120000_admission_review.sql

<!-- archivo: supabase/history/20261113120000_admission_review.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261113120000_admission_review.sql
BEGIN;

-- Requires the current portal schema, including admission_applications and roles.slug.
CREATE POLICY admissions_limit_read_scope ON public.admission_applications
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  applicant_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (
    public.has_role('coordinador')
    AND EXISTS (
      SELECT 1 FROM public.user_programs AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.program_id = admission_applications.program_id
        AND membership.status IN ('admitido', 'inscrito', 'cursando')
    )
  )
);

-- Keep even preexisting permissive policies from granting direct writes.
REVOKE INSERT, UPDATE, DELETE ON public.admission_applications FROM PUBLIC, anon, authenticated;
CREATE POLICY admissions_insert_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY admissions_update_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY admissions_delete_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- Memberships grant scope. Route writes through the API, which checks the actor.
REVOKE INSERT, UPDATE, DELETE ON public.user_programs FROM PUBLIC, anon, authenticated;
CREATE POLICY user_programs_insert_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY user_programs_update_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY user_programs_delete_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.iinicia_review_admission(
  application_id uuid,
  reviewer_id uuid,
  decision public.academic_status,
  notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

```

### supabase/history/20261114120000_course_offerings.sql

<!-- archivo: supabase/history/20261114120000_course_offerings.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261114120000_course_offerings.sql
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

```

## supabase/migrations

Los archivos se aplican por fecha. Las políticas de PostgreSQL limitan la lectura por sesión y rol incluso cuando la consulta llega directamente a la API de datos.

### supabase/migrations/20261115000000_baseline_schema.sql

<!-- archivo: supabase/migrations/20261115000000_baseline_schema.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261115000000_baseline_schema.sql
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

```

### supabase/migrations/20261116120000_staff_scope.sql

<!-- archivo: supabase/migrations/20261116120000_staff_scope.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261116120000_staff_scope.sql
BEGIN;

-- Las mutaciones administrativas pasan por NestJS para comprobar jerarquía y ámbito.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles, public.enrollment_requests
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (first_name, last_name, phone, avatar_url, bio) ON public.profiles TO authenticated;

-- Los permisos de columna protegen los campos administrativos sin volver a consultar profiles.
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_safe ON public.profiles;
CREATE POLICY profiles_update_own_safe ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE SCHEMA IF NOT EXISTS iinicia_private;
REVOKE ALL ON SCHEMA iinicia_private FROM PUBLIC;
GRANT USAGE ON SCHEMA iinicia_private TO authenticated;

-- La coordinación obtiene ámbito a partir de una afiliación académica vigente que pertenece a su sesión.
CREATE FUNCTION iinicia_private.coordinator_has_program(program uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.has_role('coordinador') AND EXISTS (
    SELECT 1 FROM public.user_programs AS membership
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.program_id = program
      AND membership.status IN ('admitido', 'inscrito', 'cursando')
  )
$$;

-- Una cuenta objetivo queda visible si comparte un programa mediante afiliación, postulación o matrícula.
CREATE FUNCTION iinicia_private.coordinator_can_read_user(person uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_programs AS membership
    WHERE membership.user_id = person
      AND iinicia_private.coordinator_has_program(membership.program_id)
  ) OR EXISTS (
    SELECT 1 FROM public.admission_applications AS application
    WHERE application.applicant_id = person
      AND iinicia_private.coordinator_has_program(application.program_id)
  ) OR EXISTS (
    SELECT 1 FROM public.enrollment_requests AS enrollment
    JOIN public.course_mappings AS course ON course.id = enrollment.course_mapping_id
    WHERE enrollment.user_id = person
      AND iinicia_private.coordinator_has_program(course.program_id)
  )
$$;

-- El catálogo ya consulta matrículas en RLS. Resolver el mapeo aquí evita recursión.
CREATE FUNCTION iinicia_private.coordinator_has_course(mapping uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_mappings AS course
    WHERE course.id = mapping AND iinicia_private.coordinator_has_program(course.program_id)
  )
$$;

REVOKE ALL ON FUNCTION iinicia_private.coordinator_has_program(uuid),
  iinicia_private.coordinator_can_read_user(uuid),
  iinicia_private.coordinator_has_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iinicia_private.coordinator_has_program(uuid),
  iinicia_private.coordinator_can_read_user(uuid),
  iinicia_private.coordinator_has_course(uuid) TO authenticated;

CREATE POLICY staff_scope_profiles ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_can_read_user(id));

CREATE POLICY staff_scope_user_roles ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_can_read_user(user_id));

CREATE POLICY staff_scope_program_memberships ON public.user_programs AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR NOT (SELECT public.has_role('coordinador'))
  OR iinicia_private.coordinator_has_program(program_id));

CREATE POLICY staff_scope_enrollments ON public.enrollment_requests AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  OR iinicia_private.coordinator_has_course(course_mapping_id));

COMMIT;

```

### supabase/migrations/20261120120000_limit_client_privileges.sql

<!-- archivo: supabase/migrations/20261120120000_limit_client_privileges.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261120120000_limit_client_privileges.sql
BEGIN;

-- Estos privilegios operan fuera de RLS y no los necesita ningún cliente del portal.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.admission_applications, public.audit_logs, public.campus_access_logs,
  public.cms_contents, public.contact_messages, public.course_mappings,
  public.enrollment_requests, public.institutional_directory, public.permissions,
  public.profiles, public.programs, public.role_permissions, public.roles,
  public.system_settings, public.user_programs, public.user_roles,
  public.wp_migration_inventory
FROM PUBLIC, anon, authenticated;

-- La API y los disparadores internos son las únicas fuentes de eventos.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs, public.campus_access_logs
FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs;
DROP POLICY IF EXISTS campus_access_logs_insert_own_or_admin ON public.campus_access_logs;

-- El formulario pasa por la validación y el límite de solicitudes de NestJS.
REVOKE INSERT ON public.contact_messages FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS contact_insert_public ON public.contact_messages;

-- La comprobación de estado consulta solo al titular de la sesión y evita recursión en profiles.
CREATE FUNCTION iinicia_private.portal_session_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status IN ('activo', 'pendiente')
    );
$$;
REVOKE ALL ON FUNCTION iinicia_private.portal_session_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION iinicia_private.portal_session_allowed() TO authenticated;

-- Se aplica la misma precondición de sesión a las tablas protegidas para conservar el alcance de las políticas existentes.
DO $$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'admission_applications', 'audit_logs', 'campus_access_logs', 'contact_messages',
    'course_mappings', 'enrollment_requests', 'profiles', 'role_permissions',
    'system_settings', 'user_programs', 'user_roles'
  ] LOOP
    EXECUTE pg_catalog.format(
      'CREATE POLICY require_portal_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING ((SELECT iinicia_private.portal_session_allowed()))
       WITH CHECK ((SELECT iinicia_private.portal_session_allowed()))',
      protected_table
    );
  END LOOP;
END
$$;

COMMIT;

```

## supabase/repairs

Archivos de este componente y su configuración.

### supabase/repairs/20261114_remote_admissions.sql

<!-- archivo: supabase/repairs/20261114_remote_admissions.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · 20261114_remote_admissions.sql
-- Reparación del Supabase de desarrollo: mmtuaangwbsdtddeplfv.
-- Revisar y ejecutar en SQL Editor. No borra tablas ni filas.
-- Reejecutable: conserva políticas preexistentes y reemplaza las funciones del proyecto.
BEGIN;

-- 20261110120000_require_mfa_data_api.sql


-- No reemplazar controles de otro proyecto o ambiente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting AS settings
    CROSS JOIN LATERAL unnest(settings.setconfig) AS config(entry)
    WHERE settings.setrole IN (0, 'authenticator'::regrole::oid)
      AND settings.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      AND split_part(config.entry, '=', 1) = 'pgrst.db_pre_request'
      AND split_part(config.entry, '=', 2) NOT IN ('', 'public.iinicia_require_mfa')
  ) THEN
    RAISE EXCEPTION 'Ya existe pgrst.db_pre_request. Integra iinicia_require_mfa en el hook existente.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.iinicia_require_mfa()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Completa la verificación en dos pasos.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.iinicia_require_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iinicia_require_mfa() TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.iinicia_require_mfa';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';


-- 20261113120000_admission_review.sql


-- Requires the current portal schema, including admission_applications and roles.slug.
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admission_applications' AND policyname = 'admissions_limit_read_scope') THEN
CREATE POLICY admissions_limit_read_scope ON public.admission_applications
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  applicant_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (
    public.has_role('coordinador')
    AND EXISTS (
      SELECT 1 FROM public.user_programs AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.program_id = admission_applications.program_id
        AND membership.status IN ('admitido', 'inscrito', 'cursando')
    )
  )
);
END IF;
END $repair$;

-- Keep even preexisting permissive policies from granting direct writes.
REVOKE INSERT, UPDATE, DELETE ON public.admission_applications FROM PUBLIC, anon, authenticated;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admission_applications' AND policyname = 'admissions_insert_via_backend_only') THEN
CREATE POLICY admissions_insert_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
END IF;
END $repair$;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admission_applications' AND policyname = 'admissions_update_via_backend_only') THEN
CREATE POLICY admissions_update_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
END IF;
END $repair$;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admission_applications' AND policyname = 'admissions_delete_via_backend_only') THEN
CREATE POLICY admissions_delete_via_backend_only ON public.admission_applications
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
END IF;
END $repair$;

-- Memberships grant scope. Route writes through the API, which checks the actor.
REVOKE INSERT, UPDATE, DELETE ON public.user_programs FROM PUBLIC, anon, authenticated;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_programs' AND policyname = 'user_programs_insert_via_backend_only') THEN
CREATE POLICY user_programs_insert_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
END IF;
END $repair$;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_programs' AND policyname = 'user_programs_update_via_backend_only') THEN
CREATE POLICY user_programs_update_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
END IF;
END $repair$;
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_programs' AND policyname = 'user_programs_delete_via_backend_only') THEN
CREATE POLICY user_programs_delete_via_backend_only ON public.user_programs
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
END IF;
END $repair$;

CREATE OR REPLACE FUNCTION public.iinicia_review_admission(
  application_id uuid,
  reviewer_id uuid,
  decision public.academic_status,
  notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iinicia_review_admission(uuid, uuid, public.academic_status, text)
TO service_role;

NOTIFY pgrst, 'reload schema';

-- 20261114120000_course_offerings.sql


-- La oferta describe cursos activos; el acceso académico sigue requiriendo
-- matrícula propia autorizada/sincronizada y los guards de NestJS.
-- Mantiene JWT + RLS: no convertir el catálogo en una lectura service_role.
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_mappings' AND policyname = 'course_mappings_select_offer') THEN
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
END IF;
END $repair$;

NOTIFY pgrst, 'reload schema';

COMMIT;

```

## supabase

Archivos de este componente y su configuración.

### supabase/seed.sql

<!-- archivo: supabase/seed.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · seed.sql
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

```

## supabase/tests

Las pruebas verifican privilegios y acceso por rol en una base de ensayo.

### supabase/tests/client_privileges.sql

<!-- archivo: supabase/tests/client_privileges.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · client_privileges.sql
-- Comprueba primero los permisos de tabla y después el efecto de las políticas sobre sesiones de prueba.
DO $$
DECLARE
  client_role text;
  entry record;
  permission text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR entry IN
      SELECT rel FROM (
        VALUES ('admission_applications'), ('audit_logs'), ('campus_access_logs'),
          ('cms_contents'), ('contact_messages'), ('course_mappings'),
          ('enrollment_requests'), ('institutional_directory'), ('permissions'),
          ('profiles'), ('programs'), ('role_permissions'), ('roles'),
          ('system_settings'), ('user_programs'), ('user_roles'), ('wp_migration_inventory')
      ) AS portal_tables(rel)
    LOOP
      FOREACH permission IN ARRAY ARRAY['TRUNCATE', 'TRIGGER', 'REFERENCES'] LOOP
        IF has_table_privilege(client_role, 'public.' || entry.rel, permission) THEN
          RAISE EXCEPTION 'Permiso % inesperado de % en %', permission, client_role, entry.rel;
        END IF;
      END LOOP;
    END LOOP;
    IF has_table_privilege(client_role, 'public.audit_logs', 'INSERT,UPDATE,DELETE')
       OR has_table_privilege(client_role, 'public.campus_access_logs', 'INSERT,UPDATE,DELETE')
       OR has_table_privilege(client_role, 'public.contact_messages', 'INSERT') THEN
      RAISE EXCEPTION 'Permisos inesperados de escritura para %', client_role;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.audit_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.campus_access_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.contact_messages', 'INSERT')
     OR NOT has_table_privilege('anon', 'public.programs', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE') THEN
    RAISE EXCEPTION 'Falta un permiso legítimo de la integración';
  END IF;
END
$$;

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('ba000000-0000-4000-8000-000000000001', 'pending-security@example.test'),
  ('ba000000-0000-4000-8000-000000000002', 'suspended-security@example.test');
UPDATE public.profiles SET status = 'suspendido' WHERE id = 'ba000000-0000-4000-8000-000000000002';

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Un aspirante pendiente conserva el acceso a su perfil con AAL2';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Un usuario AAL1 no debe leer el perfil directamente';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"ba000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Una cuenta suspendida no debe leer datos protegidos con un JWT vigente';
  END IF;
END
$$;

ROLLBACK;

```

### supabase/tests/staff_scope.sql

<!-- archivo: supabase/tests/staff_scope.sql -->
```sql
-- IINICIA Portal · persistencia y sesiones con Supabase · staff_scope.sql
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

```
