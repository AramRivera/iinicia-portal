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