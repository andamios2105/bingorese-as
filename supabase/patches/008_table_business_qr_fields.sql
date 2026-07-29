-- =====================================================================
-- PARCHE 008: cada tablero ahora tiene su propio nombre de negocio y link
-- de Google Maps (para su QR), capturados al crear el tablero y editables
-- después. Antes solo había un link global en "Verificar reseñas" — ese
-- sigue existiendo como respaldo si un tablero no tiene el suyo propio.
-- =====================================================================
-- Incremental, no borra nada existente.

alter table public.bingo_tables
  add column if not exists business_name text,
  add column if not exists google_maps_url text;

create or replace function public.admin_create_table(
  p_name text,
  p_business_name text default null,
  p_google_maps_url text default null,
  p_prize text default null,
  p_lottery_name text default null,
  p_draw_date date default null
)
returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear tableros.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'El tablero necesita un nombre.';
  end if;

  insert into public.bingo_tables (
    name, business_name, google_maps_url, prize, lottery_name, draw_date, created_by
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_business_name, '')), ''),
    nullif(trim(coalesce(p_google_maps_url, '')), ''),
    nullif(trim(coalesce(p_prize, '')), ''),
    nullif(trim(coalesce(p_lottery_name, '')), ''),
    p_draw_date,
    auth.uid()
  )
  returning * into v_table;

  return v_table;
end;
$$;

create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
  p_business_name text,
  p_google_maps_url text,
  p_prize text,
  p_lottery_name text,
  p_draw_date date
) returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar tableros.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'El tablero necesita un nombre.';
  end if;

  update public.bingo_tables
     set name = trim(p_name),
         business_name = nullif(trim(coalesce(p_business_name, '')), ''),
         google_maps_url = nullif(trim(coalesce(p_google_maps_url, '')), ''),
         prize = nullif(trim(coalesce(p_prize, '')), ''),
         lottery_name = nullif(trim(coalesce(p_lottery_name, '')), ''),
         draw_date = p_draw_date,
         updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;
