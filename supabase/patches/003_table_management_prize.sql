-- =====================================================================
-- PARCHE 003: Gestión de tableros (pausar/archivar/borrar/editar) +
-- premio, lotería y fecha de juego
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) Nuevas columnas en bingo_tables
alter table public.bingo_tables
  add column if not exists prize text,
  add column if not exists lottery_name text,
  add column if not exists draw_date date;

-- 2) Permitir el nuevo estado 'paused'
alter table public.bingo_tables drop constraint if exists bingo_tables_status_check;
alter table public.bingo_tables
  add constraint bingo_tables_status_check check (status in ('active', 'paused', 'full', 'archived'));

-- 3) admin_update_table_details: edita nombre/premio/lotería/fecha de juego
create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
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

-- 4) admin_set_table_status: pausar / reanudar / archivar
create or replace function public.admin_set_table_status(p_table_id uuid, p_status text)
returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de un tablero.';
  end if;
  if p_status not in ('active', 'paused', 'archived') then
    raise exception 'Estado inválido: %.', p_status;
  end if;

  update public.bingo_tables
     set status = p_status, updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;

-- 5) admin_delete_table: solo permite borrar tableros SIN reseñas registradas
create or replace function public.admin_delete_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar un tablero.';
  end if;

  select count(*) into v_claimed_count from public.reviews_log where table_id = p_table_id;
  if v_claimed_count > 0 then
    raise exception 'Este tablero ya tiene reseñas registradas — archívalo en vez de borrarlo para no perder el historial.';
  end if;

  delete from public.table_access where table_id = p_table_id;
  delete from public.bingo_tables where id = p_table_id;
end;
$$;
