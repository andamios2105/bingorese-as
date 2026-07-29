-- =====================================================================
-- PARCHE 013: el admin puede editar nombre/teléfono/método de pago de un
-- empleado desde el panel (el cambio de contraseña NO necesita SQL —
-- usa la API de administración de Supabase Auth directamente).
-- =====================================================================
-- Incremental, no borra nada existente.

create or replace function public.admin_update_promoter_profile(
  p_promoter_id uuid,
  p_full_name text,
  p_phone text,
  p_payment_method text,
  p_payment_number text
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar empleados.';
  end if;
  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'El empleado necesita un nombre.';
  end if;
  if p_payment_method is not null and p_payment_method not in ('nequi', 'daviplata', 'bancolombia', 'otro') then
    raise exception 'Método de pago inválido.';
  end if;

  update public.profiles
     set full_name = initcap(trim(p_full_name)),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         payment_method = p_payment_method,
         payment_number = nullif(trim(coalesce(p_payment_number, '')), ''),
         updated_at = now()
   where id = p_promoter_id and role = 'promoter'
   returning * into v_profile;

  if not found then
    raise exception 'Empleado no encontrado.';
  end if;

  return v_profile;
end;
$$;
