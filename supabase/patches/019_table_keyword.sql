-- =====================================================================
-- PARCHE 019: "Palabra clave" por tablero — la palabra o frase que cada
-- reseña de ese tablero debe mencionar (el admin la fija al crear/editar
-- el tablero, y se muestra tanto al admin como al empleado en la tarjeta
-- del premio).
-- =====================================================================
-- Incremental, no borra nada existente.

alter table public.bingo_tables add column if not exists keyword text;

comment on column public.bingo_tables.keyword is
  'Palabra/frase que el admin pide mencionar en cada reseña de este tablero (para ubicarla rápido en el listado de Google Maps).';

-- admin_create_table: ahora también recibe la palabra clave.
create or replace function public.admin_create_table(
  p_name text,
  p_business_name text default null,
  p_google_maps_url text default null,
  p_prize text default null,
  p_lottery_name text default null,
  p_draw_date date default null,
  p_keyword text default null
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
    name, business_name, google_maps_url, prize, lottery_name, draw_date, keyword, created_by
  ) values (
    initcap(trim(p_name)),
    nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
    nullif(trim(coalesce(p_google_maps_url, '')), ''),
    nullif(initcap(trim(coalesce(p_prize, ''))), ''),
    nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
    p_draw_date,
    nullif(trim(coalesce(p_keyword, '')), ''),
    auth.uid()
  )
  returning * into v_table;

  return v_table;
end;
$$;

-- admin_update_table_details: ahora también actualiza la palabra clave.
create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
  p_business_name text,
  p_google_maps_url text,
  p_prize text,
  p_lottery_name text,
  p_draw_date date,
  p_keyword text default null
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
     set name = initcap(trim(p_name)),
         business_name = nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
         google_maps_url = nullif(trim(coalesce(p_google_maps_url, '')), ''),
         prize = nullif(initcap(trim(coalesce(p_prize, ''))), ''),
         lottery_name = nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
         draw_date = p_draw_date,
         keyword = nullif(trim(coalesce(p_keyword, '')), ''),
         updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;
