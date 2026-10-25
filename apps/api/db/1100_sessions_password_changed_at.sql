-- =====================================================================
-- 1100 · Revocación de sesiones por cambio de contraseña
--
-- Migración incremental e idempotente para un proyecto que ya tiene
-- aplicado `iinicia_schema_completo.sql` (todas las columnas/tablas
-- existentes). Refleja el mismo cambio que ya aparece en ese archivo:
--   1. profiles.password_changed_at
--   2. private.handle_user_email_change() sincroniza correo y fecha
--   3. el trigger on_auth_user_email_changed también escucha updated_password_at
--
-- La columna es NULLABLE: hasta el primer cambio de contraseña no hay
-- fecha y la API no revoca nada (un token previo sigue siendo válido).
-- Riesgo de bloqueo: ninguno, si el script se aplica correctamente. El
-- riesgo de bloquearse a sí mismo solo existiría con un valor por defecto
-- tipo now(); no lo hay.
--
-- Requiere `auth.users.updated_password_at` (columna de GoTrue, ya presente
-- en proyectos actuales de Supabase). El script lo verifica antes de tocar
-- el trigger.
-- =====================================================================

begin;

-- 1. Columna de revocación --------------------------------------------
alter table public.profiles
  add column if not exists password_changed_at timestamptz;

comment on column public.profiles.password_changed_at is
  'Último cambio de contraseña en Supabase Auth; la API rechaza access tokens emitidos antes.';

-- 2. Función de sincronización ----------------------------------------
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email               = lower(new.email),
         password_changed_at = coalesce(new.updated_password_at, password_changed_at)
   where id = new.id;

  return new;
end;
$$;

-- 3. Trigger ----------------------------------------------------------
-- Si la columna no existiera, solo se preserva la sincronización del correo
-- en lugar de romper el script.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name   = 'users'
      and column_name  = 'updated_password_at'
  ) then
    drop trigger if exists on_auth_user_email_changed on auth.users;

    create trigger on_auth_user_email_changed
      after update of email, updated_password_at on auth.users
      for each row
      when (
        old.email is distinct from new.email
        or old.updated_password_at is distinct from new.updated_password_at
      )
      execute function private.handle_user_email_change();
  else
    drop trigger if exists on_auth_user_email_changed on auth.users;

    create trigger on_auth_user_email_changed
      after update of email on auth.users
      for each row
      when (old.email is distinct from new.email)
      execute function private.handle_user_email_change();

    raise warning 'auth.users.updated_password_at no existe: se omite la revocación por cambio de contraseña.';
  end if;
end;
$$;

commit;

-- Verificación
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'password_changed_at';
