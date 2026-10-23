-- =====================================================================
-- 0100 · Extensiones, esquemas y tipos enumerados
-- Proyecto IINICIA · Supabase (DEV)
-- =====================================================================

-- Búsqueda difusa de usuarios (panel administrativo)
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Esquema privado: helpers de seguridad y funciones de trigger.
-- No se expone por la API de Supabase (PostgREST), solo se usa desde RLS/triggers.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tipos enumerados (conjuntos pequeños y estables)
-- ---------------------------------------------------------------------

-- Estado de la cuenta en el portal
create type public.account_status as enum (
  'pending',      -- registrada, aún sin autorizar
  'active',       -- autorizada
  'suspended',    -- bloqueada por un administrador
  'inactive'      -- baja
);

-- Tipo de programa académico (oferta académica)
create type public.program_type as enum (
  'degree',         -- licenciatura
  'diploma',        -- diplomado
  'certification',  -- certificación
  'course'          -- curso
);

-- Estatus académico/administrativo del usuario dentro de un programa
create type public.user_program_status as enum (
  'applicant',  -- aspirante / en proceso de admisión
  'admitted',   -- admitido
  'enrolled',   -- inscrito / cursando
  'completed',  -- concluyó
  'withdrawn',  -- baja
  'rejected'    -- no admitido
);

-- Rol de matrícula en Moodle (shortnames oficiales de Moodle)
create type public.enrollment_role as enum (
  'student',
  'teacher',          -- profesor sin edición
  'editingteacher'    -- profesor (con edición)
);

-- Ciclo de vida de una solicitud de inscripción
create type public.enrollment_status as enum (
  'pending',    -- solicitada, esperando revisión
  'approved',   -- autorizada, pendiente de sincronizar con Moodle
  'rejected',
  'cancelled',
  'synced',     -- matriculada en Moodle
  'failed'      -- falló la sincronización con Moodle (reintentable)
);

-- Estado de sincronización con Moodle
create type public.sync_status as enum (
  'not_synced',
  'pending',
  'synced',
  'error'
);
-- =====================================================================
-- 0200 · Catálogos: roles, permisos, role_permissions, programas
-- =====================================================================

-- ---------------------------------------------------------------------
-- roles: catálogo de roles de la plataforma (RBAC, sección 6 del PDF)
-- rank: jerarquía (mayor = más privilegios). Evita escaladas de privilegio.
-- ---------------------------------------------------------------------
create table public.roles (
  id                    smallint generated always as identity primary key,
  code                  text        not null,
  name                  text        not null,
  description           text,
  rank                  smallint    not null,
  moodle_role_shortname text,
  is_system             boolean     not null default true,
  created_at            timestamptz not null default now(),

  constraint roles_code_key        unique (code),
  constraint roles_code_format     check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint roles_rank_range      check (rank between 0 and 100)
);
comment on table  public.roles is 'Catálogo de roles de la plataforma.';
comment on column public.roles.rank is 'Jerarquía: un usuario solo puede otorgar roles con rank menor al suyo (superadmin exceptuado).';
comment on column public.roles.moodle_role_shortname is 'Rol equivalente en Moodle cuando aplica (student, editingteacher, ...).';

-- ---------------------------------------------------------------------
-- permissions: permisos granulares con formato recurso.acción
-- ---------------------------------------------------------------------
create table public.permissions (
  id          smallint generated always as identity primary key,
  code        text        not null,
  description text,
  created_at  timestamptz not null default now(),

  constraint permissions_code_key    unique (code),
  constraint permissions_code_format check (code ~ '^[a-z_]+\.[a-z_]+$')
);
comment on table public.permissions is 'Permisos granulares (recurso.acción).';

-- ---------------------------------------------------------------------
-- role_permissions: N:M entre roles y permisos
-- ---------------------------------------------------------------------
create table public.role_permissions (
  role_id       smallint not null references public.roles(id)       on delete cascade,
  permission_id smallint not null references public.permissions(id) on delete cascade,

  primary key (role_id, permission_id)
);
comment on table public.role_permissions is 'Permisos otorgados a cada rol.';

-- ---------------------------------------------------------------------
-- programs: licenciaturas, diplomados, certificaciones y cursos
-- ---------------------------------------------------------------------
create table public.programs (
  id             uuid        primary key default gen_random_uuid(),
  code           text        not null,
  slug           text        not null,
  name           text        not null,
  type           public.program_type not null,
  summary        text,
  description    text,
  duration_hours smallint,
  is_published   boolean     not null default false,
  is_active      boolean     not null default true,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint programs_code_key      unique (code),
  constraint programs_slug_key      unique (slug),
  constraint programs_code_format   check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint programs_slug_format   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint programs_name_not_blank check (length(btrim(name)) > 0),
  constraint programs_duration_pos  check (duration_hours is null or duration_hours > 0)
);
comment on table  public.programs is 'Oferta académica del portal (programas, diplomados, certificaciones, cursos).';
comment on column public.programs.is_published is 'Visible en el sitio público (/oferta-academica).';
comment on column public.programs.deleted_at   is 'Baja lógica.';
-- =====================================================================
-- 0300 · Usuarios: profiles, profile_details, user_roles, user_programs
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: 1:1 con auth.users. NO guarda contraseñas (CA-04).
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid        primary key references auth.users(id) on delete cascade,
  email              text        not null,
  first_name         text,
  last_name          text,
  phone              text,
  status             public.account_status not null default 'pending',

  -- Vínculo e integración con Moodle
  moodle_user_id     bigint,
  moodle_username    text,
  moodle_sync_status public.sync_status not null default 'not_synced',
  moodle_synced_at   timestamptz,
  moodle_sync_error  text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint profiles_email_format     check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  constraint profiles_first_name_blank check (first_name is null or length(btrim(first_name)) > 0),
  constraint profiles_last_name_blank  check (last_name  is null or length(btrim(last_name))  > 0),
  constraint profiles_phone_format     check (phone is null or phone ~ '^\+?[0-9 ()\-]{7,20}$'),
  constraint profiles_moodle_id_pos    check (moodle_user_id is null or moodle_user_id > 0),
  constraint profiles_moodle_synced_ok check (
    moodle_sync_status <> 'synced'
    or (moodle_user_id is not null and moodle_synced_at is not null)
  )
);
comment on table  public.profiles is 'Perfil del usuario del portal (1:1 con auth.users).';
comment on column public.profiles.status is 'Estado administrativo de la cuenta. Solo modificable desde el backend.';
comment on column public.profiles.moodle_user_id is 'ID del usuario en Moodle; NULL hasta que el backend lo cree o vincule.';

-- ---------------------------------------------------------------------
-- profile_details: datos complementarios (1:1), separados del núcleo
-- ---------------------------------------------------------------------
create table public.profile_details (
  user_id      uuid        primary key references public.profiles(id) on delete cascade,
  birth_date   date,
  country_code char(2),
  state        text,
  city         text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profile_details_birth_date check (birth_date is null or birth_date >= date '1900-01-01'),
  constraint profile_details_country    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profile_details_bio_len    check (bio is null or length(bio) <= 2000)
);
comment on table public.profile_details is 'Datos complementarios del perfil (nacimiento, ubicación, avatar, bio).';

-- ---------------------------------------------------------------------
-- user_roles: N:M usuario-rol. program_id acota el rol a un programa
-- (p. ej. un coordinador solo de ciertos programas). NULL = rol global.
-- ---------------------------------------------------------------------
create table public.user_roles (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  role_id    smallint    not null references public.roles(id)    on delete restrict,
  program_id uuid                 references public.programs(id) on delete cascade,
  granted_by uuid                 references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint user_roles_unique unique nulls not distinct (user_id, role_id, program_id)
);
comment on table  public.user_roles is 'Roles asignados a cada usuario (un usuario puede tener varios).';
comment on column public.user_roles.program_id is 'Ámbito del rol. NULL = global. Un coordinador solo ve lo de sus programas.';

-- ---------------------------------------------------------------------
-- user_programs: usuario ↔ programa y su estatus
-- ---------------------------------------------------------------------
create table public.user_programs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  program_id   uuid        not null references public.programs(id) on delete restrict,
  status       public.user_program_status not null default 'applicant',
  applied_at   timestamptz not null default now(),
  admitted_at  timestamptz,
  enrolled_at  timestamptz,
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint user_programs_unique       unique (user_id, program_id),
  constraint user_programs_dates_order  check (
    (admitted_at  is null or admitted_at  >= applied_at)
    and (enrolled_at  is null or admitted_at is null or enrolled_at  >= admitted_at)
    and (completed_at is null or enrolled_at is null or completed_at >= enrolled_at)
  )
);
comment on table public.user_programs is 'Relación usuario-programa con su estatus académico/administrativo.';
-- =====================================================================
-- 0400 · Académico: course_mappings, enrollment_requests · Auditoría
-- =====================================================================

-- ---------------------------------------------------------------------
-- course_mappings: curso de Moodle ↔ portal (opcionalmente ligado a un programa)
-- Un course_id de Moodle se mapea una sola vez.
-- ---------------------------------------------------------------------
create table public.course_mappings (
  id               uuid        primary key default gen_random_uuid(),
  program_id       uuid                 references public.programs(id) on delete set null,
  moodle_course_id bigint      not null,
  moodle_shortname text        not null,
  moodle_fullname  text        not null,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint course_mappings_moodle_id_key unique (moodle_course_id),
  constraint course_mappings_moodle_id_pos check (moodle_course_id > 0),
  constraint course_mappings_names_blank   check (length(btrim(moodle_shortname)) > 0 and length(btrim(moodle_fullname)) > 0)
);
comment on table public.course_mappings is 'Relación entre elementos del portal y course_id de Moodle.';

-- ---------------------------------------------------------------------
-- enrollment_requests: solicitudes/autorizaciones de inscripción
-- Flujo: pending → approved → synced (o failed → reintento) | rejected | cancelled
-- ---------------------------------------------------------------------
create table public.enrollment_requests (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id)        on delete cascade,
  course_mapping_id uuid        not null references public.course_mappings(id) on delete restrict,
  user_program_id   uuid                 references public.user_programs(id)   on delete set null,
  requested_role    public.enrollment_role   not null default 'student',
  status            public.enrollment_status not null default 'pending',

  requested_by      uuid                 references public.profiles(id) on delete set null,
  reviewed_by       uuid                 references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_notes      text,

  starts_at         timestamptz,
  ends_at           timestamptz,

  -- Control de sincronización con Moodle
  sync_attempts     smallint    not null default 0,
  synced_at         timestamptz,
  sync_error        text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint enrollment_requests_period    check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint enrollment_requests_attempts  check (sync_attempts >= 0),
  constraint enrollment_requests_reviewed  check (
    status not in ('approved','rejected','synced') or reviewed_at is not null
  ),
  constraint enrollment_requests_synced    check (status <> 'synced' or synced_at is not null)
);
comment on table public.enrollment_requests is 'Solicitudes de inscripción a cursos; fuente de verdad de qué cursos tiene autorizados cada usuario.';

-- ---------------------------------------------------------------------
-- audit_logs: bitácora inmutable (CA-19)
-- Sin FKs a propósito: la evidencia debe sobrevivir al borrado de usuarios.
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  action      text        not null,
  entity_type text        not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb,
  metadata    jsonb       not null default '{}'::jsonb,
  ip_address  inet,
  user_agent  text,

  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0)
);
comment on table  public.audit_logs is 'Bitácora append-only de cambios relevantes (altas, roles, estados, programas, matrículas).';
comment on column public.audit_logs.actor_id is 'Quien ejecutó la acción. NULL = sistema / backend sin actor indicado.';
-- =====================================================================
-- 0500 · Índices
-- Criterio: un índice por cada FK consultada, más los de búsqueda,
-- unicidad parcial y colas de trabajo (sincronización con Moodle).
-- =====================================================================

-- ---- profiles -------------------------------------------------------
create unique index profiles_email_uidx          on public.profiles (lower(email));
create unique index profiles_moodle_user_uidx    on public.profiles (moodle_user_id)       where moodle_user_id is not null;
create unique index profiles_moodle_username_uidx on public.profiles (lower(moodle_username)) where moodle_username is not null;
create index profiles_status_idx                 on public.profiles (status)               where deleted_at is null;
create index profiles_created_at_idx             on public.profiles (created_at desc);
-- Cola de usuarios por sincronizar o con error
create index profiles_moodle_pending_idx         on public.profiles (moodle_sync_status)   where moodle_sync_status <> 'synced';
-- Búsqueda difusa por nombre y correo (panel administrativo)
create index profiles_name_trgm_idx  on public.profiles
  using gin ((coalesce(first_name, '') || ' ' || coalesce(last_name, '')) extensions.gin_trgm_ops);
create index profiles_email_trgm_idx on public.profiles
  using gin (lower(email) extensions.gin_trgm_ops);

-- ---- role_permissions ----------------------------------------------
create index role_permissions_permission_idx on public.role_permissions (permission_id);

-- ---- programs -------------------------------------------------------
create index programs_public_idx on public.programs (type, sort_order)
  where is_published and is_active and deleted_at is null;

-- ---- user_roles (el unique cubre user_id como columna líder) --------
create index user_roles_role_idx       on public.user_roles (role_id);
create index user_roles_program_idx    on public.user_roles (program_id)  where program_id is not null;
create index user_roles_granted_by_idx on public.user_roles (granted_by)  where granted_by is not null;

-- ---- user_programs (el unique cubre user_id) ------------------------
create index user_programs_program_status_idx on public.user_programs (program_id, status);

-- ---- course_mappings ------------------------------------------------
create index course_mappings_program_idx on public.course_mappings (program_id) where program_id is not null;

-- ---- enrollment_requests -------------------------------------------
-- Un usuario no puede tener dos solicitudes abiertas al mismo curso
create unique index enrollment_requests_open_uidx
  on public.enrollment_requests (user_id, course_mapping_id)
  where status in ('pending', 'approved', 'synced');
create index enrollment_requests_user_status_idx   on public.enrollment_requests (user_id, status);
create index enrollment_requests_course_status_idx on public.enrollment_requests (course_mapping_id, status);
-- Cola de trabajo del backend: pendientes de revisar o de sincronizar
create index enrollment_requests_queue_idx         on public.enrollment_requests (status, created_at)
  where status in ('pending', 'approved', 'failed');
create index enrollment_requests_user_program_idx  on public.enrollment_requests (user_program_id) where user_program_id is not null;
create index enrollment_requests_requested_by_idx  on public.enrollment_requests (requested_by)    where requested_by is not null;
create index enrollment_requests_reviewed_by_idx   on public.enrollment_requests (reviewed_by)     where reviewed_by  is not null;

-- ---- audit_logs -----------------------------------------------------
create index audit_logs_entity_idx   on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx    on public.audit_logs (actor_id, occurred_at desc) where actor_id is not null;
create index audit_logs_action_idx   on public.audit_logs (action, occurred_at desc);
create index audit_logs_occurred_brin on public.audit_logs using brin (occurred_at);
-- =====================================================================
-- 0600 · Funciones (esquema private)
-- Helpers de seguridad para RLS + funciones de trigger.
-- Todas con search_path vacío para evitar secuestro de esquemas.
-- =====================================================================

-- ---- Actor de la operación -----------------------------------------
-- Usuario autenticado (JWT) o, si el backend usa service_role, el valor
-- indicado con: select set_config('app.actor_id', '<uuid>', true);
create or replace function private.actor_id()
returns uuid
language sql stable
set search_path = ''
as $$
  select coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)
$$;

-- ---- Helpers de autorización (usados por RLS) -----------------------
-- Solo cuentan usuarios activos y roles GLOBALES (program_id is null).
create or replace function private.has_permission(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles pr         on pr.id = ur.user_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p       on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and ur.program_id is null
      and p.code = p_code
      and pr.status = 'active'
      and pr.deleted_at is null
  )
$$;

create or replace function private.has_role(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r     on r.id = ur.role_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and r.code = p_code
      and pr.status = 'active'
      and pr.deleted_at is null
  )
$$;

-- Rank máximo de un usuario (roles globales activos)
create or replace function private.user_max_rank(p_user uuid)
returns smallint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(max(r.rank), 0)::smallint
  from public.user_roles ur
  join public.roles r     on r.id = ur.role_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = p_user
    and ur.program_id is null
    and pr.status = 'active'
    and pr.deleted_at is null
$$;

-- ¿El usuario actual coordina este programa?
create or replace function private.coordinates_program(p_program uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_program is not null and exists (
    select 1
    from public.user_roles ur
    join public.roles r     on r.id = ur.role_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and r.code = 'coordinator'
      and ur.program_id = p_program
      and pr.status = 'active'
      and pr.deleted_at is null
  )
$$;

-- ¿El usuario actual coordina algún programa de este usuario?
create or replace function private.coordinates_user(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_programs up
    where up.user_id = p_user
      and private.coordinates_program(up.program_id)
  )
$$;

-- ¿El usuario actual coordina el programa de este curso mapeado?
create or replace function private.coordinates_course(p_mapping uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_mappings cm
    where cm.id = p_mapping
      and private.coordinates_program(cm.program_id)
  )
$$;

-- =====================================================================
-- Funciones de trigger
-- =====================================================================

-- updated_at automático
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Alta de usuario: crea perfil, detalles y rol inicial 'applicant'.
-- Los datos vienen de raw_user_meta_data (controlado por el usuario):
-- NUNCA se confía en él para roles ni estado.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_first text := nullif(btrim(new.raw_user_meta_data->>'first_name'), '');
  v_last  text := nullif(btrim(new.raw_user_meta_data->>'last_name'),  '');
  v_phone text := nullif(btrim(new.raw_user_meta_data->>'phone'),      '');
  v_role  smallint;
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()\-]{7,20}$' then
    v_phone := null;  -- un teléfono mal formado no debe romper el registro
  end if;

  insert into public.profiles (id, email, first_name, last_name, phone)
  values (new.id, lower(new.email), v_first, v_last, v_phone);

  insert into public.profile_details (user_id) values (new.id);

  select id into v_role from public.roles where code = 'applicant';
  if v_role is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, v_role);
  end if;

  return new;
end;
$$;

-- Mantener profiles.email alineado con auth.users
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

-- No permitir quedarse sin superadministrador
create or replace function private.guard_last_superadmin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_super smallint;
begin
  select id into v_super from public.roles where code = 'superadmin';

  if old.role_id = v_super
     and (tg_op = 'DELETE' or new.role_id is distinct from old.role_id) then
    if not exists (
      select 1 from public.user_roles
      where role_id = v_super and id <> old.id
    ) then
      raise exception 'No se puede retirar al último superadministrador'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Anti-escalada: nadie otorga un rol con rank >= al suyo (salvo superadmin).
-- Sin actor identificable (alta automática, SQL Editor) no se evalúa.
create or replace function private.guard_role_grant()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor       uuid := coalesce(private.actor_id(), new.granted_by);
  v_target_rank smallint;
  v_actor_rank  smallint;
begin
  if v_actor is null then
    return new;
  end if;

  select rank into v_target_rank from public.roles where id = new.role_id;
  v_actor_rank := private.user_max_rank(v_actor);

  if v_actor_rank < 100 and v_target_rank >= v_actor_rank then
    raise exception 'Privilegios insuficientes para otorgar este rol'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Auditoría genérica: guarda solo los campos que cambiaron en los UPDATE.
create or replace function private.log_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old      jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new      jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_entity   text  := coalesce(v_new->>'id', v_new->>'user_id', v_old->>'id', v_old->>'user_id');
  v_old_diff jsonb;
  v_new_diff jsonb;
  v_ip       inet;
  v_ua       text;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value),
           jsonb_object_agg(n.key, v_old -> n.key)
      into v_new_diff, v_old_diff
      from jsonb_each(v_new) n
     where n.key <> 'updated_at'
       and (v_old -> n.key) is distinct from n.value;

    if v_new_diff is null then
      return null;  -- solo cambió updated_at
    end if;
    v_old := v_old_diff;
    v_new := v_new_diff;
  end if;

  begin
    v_ip := nullif(split_part(coalesce(
              current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1), '')::inet;
    v_ua := current_setting('request.headers', true)::jsonb ->> 'user-agent';
  exception when others then
    v_ip := null; v_ua := null;
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
  values (private.actor_id(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity, v_old, v_new, v_ip, v_ua);

  return null;
end;
$$;

-- La bitácora es append-only
create or replace function private.block_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs es de solo inserción'
    using errcode = 'insufficient_privilege';
end;
$$;

-- =====================================================================
-- Permisos de ejecución: solo los helpers de RLS son invocables
-- =====================================================================
revoke execute on all functions in schema private from public, anon;

grant execute on function
  private.actor_id(),
  private.has_permission(text),
  private.has_role(text),
  private.user_max_rank(uuid),
  private.coordinates_program(uuid),
  private.coordinates_user(uuid),
  private.coordinates_course(uuid)
to authenticated, service_role;
-- =====================================================================
-- 0700 · Triggers
-- =====================================================================

-- ---- updated_at -----------------------------------------------------
create trigger trg_profiles_updated_at         before update on public.profiles         for each row execute function private.set_updated_at();
create trigger trg_profile_details_updated_at  before update on public.profile_details  for each row execute function private.set_updated_at();
create trigger trg_programs_updated_at         before update on public.programs         for each row execute function private.set_updated_at();
create trigger trg_user_programs_updated_at    before update on public.user_programs    for each row execute function private.set_updated_at();
create trigger trg_course_mappings_updated_at  before update on public.course_mappings  for each row execute function private.set_updated_at();
create trigger trg_enrollment_requests_updated_at before update on public.enrollment_requests for each row execute function private.set_updated_at();

-- ---- Reglas de integridad sobre roles -------------------------------
create trigger trg_user_roles_guard_grant
  before insert or update on public.user_roles
  for each row execute function private.guard_role_grant();

create trigger trg_user_roles_guard_last_superadmin
  before update or delete on public.user_roles
  for each row execute function private.guard_last_superadmin();

-- ---- Auditoría (CA-19) ----------------------------------------------
create trigger trg_audit_profiles            after insert or update or delete on public.profiles            for each row execute function private.log_row_change();
create trigger trg_audit_user_roles          after insert or update or delete on public.user_roles          for each row execute function private.log_row_change();
create trigger trg_audit_programs            after insert or update or delete on public.programs            for each row execute function private.log_row_change();
create trigger trg_audit_user_programs       after insert or update or delete on public.user_programs       for each row execute function private.log_row_change();
create trigger trg_audit_course_mappings     after insert or update or delete on public.course_mappings     for each row execute function private.log_row_change();
create trigger trg_audit_enrollment_requests after insert or update or delete on public.enrollment_requests for each row execute function private.log_row_change();

-- ---- Bitácora inmutable ---------------------------------------------
create trigger trg_audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function private.block_audit_mutation();

create trigger trg_audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.block_audit_mutation();

-- ---- Supabase Auth → portal -----------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();
-- =====================================================================
-- 0800 · Datos base: roles, permisos y matriz rol-permiso
-- (van en TODOS los ambientes, por eso están en una migración)
-- =====================================================================

insert into public.roles (code, name, description, rank, moodle_role_shortname) values
  ('superadmin',  'Superadministrador', 'Configuración global, usuarios, roles, integraciones y auditoría.', 100, null),
  ('admin',       'Administrador',      'Gestión de usuarios, estados, programas, autorizaciones e inscripciones.', 80, null),
  ('coordinator', 'Coordinador',        'Consulta y gestión de usuarios/programas dentro de su ámbito.', 60, null),
  ('support',     'Soporte',            'Atención operativa limitada y consulta controlada.', 40, null),
  ('teacher',     'Profesor',           'Perfil docente y cursos asignados.', 30, 'editingteacher'),
  ('student',     'Estudiante',         'Perfil, programa y cursos asignados.', 20, 'student'),
  ('applicant',   'Aspirante',          'Registro y seguimiento de admisión. Sin acceso a cursos.', 10, null)
on conflict (code) do nothing;

insert into public.permissions (code, description) values
  ('roles.read',          'Consultar catálogo de roles y permisos'),
  ('roles.manage',        'Crear/editar roles y permisos'),
  ('users.read',          'Consultar usuarios y perfiles'),
  ('users.update',        'Editar usuarios, estado y autorización'),
  ('user_roles.read',     'Consultar roles asignados'),
  ('user_roles.manage',   'Asignar y retirar roles'),
  ('programs.read',       'Consultar todos los programas (incluso no publicados)'),
  ('programs.manage',     'Crear/editar programas'),
  ('user_programs.read',  'Consultar asociaciones usuario-programa'),
  ('user_programs.manage','Asignar usuarios a programas'),
  ('courses.read',        'Consultar mapeo de cursos de Moodle'),
  ('courses.manage',      'Administrar mapeo de cursos de Moodle'),
  ('enrollments.read',    'Consultar solicitudes de inscripción'),
  ('enrollments.manage',  'Autorizar y gestionar inscripciones'),
  ('audit.read',          'Consultar la bitácora'),
  ('integrations.read',   'Ver estado de sincronización con Moodle'),
  ('integrations.sync',   'Ejecutar sincronización con Moodle'),
  ('integrations.manage', 'Configurar la integración con Moodle')
on conflict (code) do nothing;

-- superadmin: todo
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'superadmin'
on conflict do nothing;

-- admin: todo excepto gestionar roles/permisos y configurar la integración
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin'
  and p.code not in ('roles.manage', 'integrations.manage')
on conflict do nothing;

-- soporte: consulta limitada
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('users.read', 'programs.read')
where r.code = 'support'
on conflict do nothing;

-- coordinator, teacher, student, applicant: sin permisos globales.
-- Acceden a lo propio (políticas RLS "own") y el coordinador a su ámbito
-- (user_roles.program_id + funciones coordinates_*).
-- =====================================================================
-- 0900 · Row Level Security
--
-- Modelo:
--  * El navegador (rol authenticated/anon) solo LEE lo que le corresponde
--    y solo ESCRIBE su propio perfil básico.
--  * Toda escritura privilegiada (estado, roles, programas, matrículas,
--    sincronización con Moodle) la hace el backend NestJS con service_role,
--    que se salta RLS y valida permisos del lado servidor.
-- =====================================================================

alter table public.roles               enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.programs            enable row level security;
alter table public.profiles            enable row level security;
alter table public.profile_details     enable row level security;
alter table public.user_roles          enable row level security;
alter table public.user_programs       enable row level security;
alter table public.course_mappings     enable row level security;
alter table public.enrollment_requests enable row level security;
alter table public.audit_logs          enable row level security;

-- ---- Catálogos ------------------------------------------------------
create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

create policy permissions_select_staff on public.permissions
  for select to authenticated using (private.has_permission('roles.read'));

create policy role_permissions_select_staff on public.role_permissions
  for select to authenticated using (private.has_permission('roles.read'));

-- ---- programs -------------------------------------------------------
-- Oferta pública (incluye visitantes sin sesión)
create policy programs_select_public on public.programs
  for select to anon, authenticated
  using (is_published and is_active and deleted_at is null);

create policy programs_select_staff on public.programs
  for select to authenticated
  using (private.has_permission('programs.read') or private.coordinates_program(id));

create policy programs_select_own on public.programs
  for select to authenticated
  using (exists (
    select 1 from public.user_programs up
    where up.program_id = programs.id and up.user_id = (select auth.uid())
  ));

-- ---- profiles -------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and deleted_at is null);

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (private.has_permission('users.read') or private.coordinates_user(id));

-- Solo columnas first_name, last_name, phone (ver GRANT column-level)
create policy profiles_update_own on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

-- ---- profile_details ------------------------------------------------
create policy profile_details_select_own on public.profile_details
  for select to authenticated using (user_id = (select auth.uid()));

create policy profile_details_select_staff on public.profile_details
  for select to authenticated
  using (private.has_permission('users.read') or private.coordinates_user(user_id));

create policy profile_details_insert_own on public.profile_details
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy profile_details_update_own on public.profile_details
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- user_roles -----------------------------------------------------
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_roles_select_staff on public.user_roles
  for select to authenticated using (private.has_permission('user_roles.read'));

-- ---- user_programs --------------------------------------------------
create policy user_programs_select_own on public.user_programs
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_programs_select_staff on public.user_programs
  for select to authenticated
  using (private.has_permission('user_programs.read') or private.coordinates_program(program_id));

-- ---- course_mappings ------------------------------------------------
create policy course_mappings_select_staff on public.course_mappings
  for select to authenticated
  using (private.has_permission('courses.read') or private.coordinates_program(program_id));

-- Un usuario ve solo los cursos en los que está matriculado (sincronizado)
create policy course_mappings_select_authorized on public.course_mappings
  for select to authenticated
  using (is_active and exists (
    select 1 from public.enrollment_requests er
    where er.course_mapping_id = course_mappings.id
      and er.user_id = (select auth.uid())
      and er.status = 'synced'
  ));

-- ---- enrollment_requests --------------------------------------------
create policy enrollment_requests_select_own on public.enrollment_requests
  for select to authenticated using (user_id = (select auth.uid()));

create policy enrollment_requests_select_staff on public.enrollment_requests
  for select to authenticated
  using (private.has_permission('enrollments.read') or private.coordinates_course(course_mapping_id));

-- ---- audit_logs -----------------------------------------------------
create policy audit_logs_select_staff on public.audit_logs
  for select to authenticated using (private.has_permission('audit.read'));
-- =====================================================================
-- 1000 · Vistas y privilegios (GRANT)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vistas (security_invoker: aplican el RLS de quien consulta)
-- ---------------------------------------------------------------------

-- "Mi IINICIA": cursos autorizados del usuario en sesión.
-- Solo matrículas ya sincronizadas en Moodle y vigentes.
create view public.v_my_courses
with (security_invoker = true) as
select
  er.id                as enrollment_request_id,
  cm.moodle_course_id,
  cm.moodle_shortname,
  cm.moodle_fullname,
  er.requested_role,
  er.starts_at,
  er.ends_at,
  pr.id                as program_id,
  pr.slug              as program_slug,
  pr.name              as program_name
from public.enrollment_requests er
join public.course_mappings cm on cm.id = er.course_mapping_id
left join public.programs pr   on pr.id = cm.program_id
where er.user_id = (select auth.uid())
  and er.status = 'synced'
  and cm.is_active
  and (er.ends_at is null or er.ends_at > now());

-- Panel administrativo: listado de usuarios con roles y estado de Moodle.
-- Las filas visibles dependen del RLS de profiles (staff / coordinador).
create view public.v_admin_users
with (security_invoker = true) as
select
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.phone,
  p.status,
  p.created_at,
  p.moodle_user_id,
  p.moodle_sync_status,
  p.moodle_synced_at,
  p.moodle_sync_error,
  coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as roles
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
left join public.roles r       on r.id = ur.role_id
where p.deleted_at is null
group by p.id;

-- ---------------------------------------------------------------------
-- Privilegios: lista blanca. Se parte de cero para anon/authenticated.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Visitantes: solo la oferta académica publicada (filtrada por RLS)
grant select on public.programs to anon;

-- Usuarios con sesión: lectura (RLS decide qué filas)
grant select on
  public.roles, public.permissions, public.role_permissions,
  public.programs, public.profiles, public.profile_details,
  public.user_roles, public.user_programs, public.course_mappings,
  public.enrollment_requests, public.audit_logs,
  public.v_my_courses, public.v_admin_users
to authenticated;

-- Escritura directa desde el navegador: solo datos personales no sensibles.
-- status, moodle_*, deleted_at, etc. quedan fuera a propósito.
grant update (first_name, last_name, phone) on public.profiles to authenticated;
grant insert (user_id, birth_date, country_code, state, city, avatar_url, bio)
  on public.profile_details to authenticated;
grant update (birth_date, country_code, state, city, avatar_url, bio)
  on public.profile_details to authenticated;

-- Backend (service_role): acceso completo
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 1) Verificar huérfanos antes de crear la FK
SELECT count(*) AS orphan_actor_ids
FROM public.audit_logs AS a
         LEFT JOIN public.profiles AS p ON p.id = a.actor_id
WHERE a.actor_id IS NOT NULL
  AND p.id IS NULL;

-- 2) Crear la llave foránea conservando la bitácora
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey
        FOREIGN KEY (actor_id)
            REFERENCES public.profiles(id)
            ON DELETE SET NULL;