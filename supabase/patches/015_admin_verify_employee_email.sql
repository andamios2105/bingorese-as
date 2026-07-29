-- =====================================================================
-- PARCHE 015: el admin ve si cada empleado confirmó su correo, y puede
-- verificarlo manualmente con un botón (sin depender del link del
-- correo, que a veces falla en configuraciones nuevas de Supabase).
-- =====================================================================
-- Incremental, no borra nada existente.

create or replace function public.admin_list_promoter_verification()
returns table (promoter_id uuid, email_confirmed boolean)
language sql
security definer
set search_path = public
as $$
  select p.id, (au.email_confirmed_at is not null)
    from public.profiles p
    join auth.users au on au.id = p.id
   where p.role = 'promoter'
     and public.is_admin();
$$;

create or replace function public.admin_verify_promoter_email(p_promoter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede verificar cuentas.';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = p_promoter_id;
end;
$$;
