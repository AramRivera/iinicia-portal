-- =====================================================================
-- Crear el PRIMER superadministrador (se corre una sola vez, en el SQL Editor)
--
-- 1) Regístrate desde el portal (/registro) o en Supabase:
--    Authentication > Users > Add user (con "Auto Confirm User").
-- 2) Cambia el correo de abajo y ejecuta el script.
-- =====================================================================
do $$
declare
  v_email text := lower('TU_CORREO@dominio.com');  -- <-- CAMBIAR
  v_user  uuid;
  v_super smallint;
begin
  select id into v_user from public.profiles where email = v_email;
  if v_user is null then
    raise exception 'No existe un perfil con el correo %', v_email;
  end if;

  select id into v_super from public.roles where code = 'superadmin';

  update public.profiles set status = 'active' where id = v_user;

  insert into public.user_roles (user_id, role_id)
  values (v_user, v_super)
  on conflict do nothing;

  -- Ya no es aspirante
  delete from public.user_roles
  where user_id = v_user
    and role_id = (select id from public.roles where code = 'applicant');
end $$;
