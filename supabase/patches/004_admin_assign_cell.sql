-- =====================================================================
-- PARCHE 004: el admin puede asignar una casilla directamente a un
-- empleado, sin pasar por reseña/captura/verificación.
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) google_handle y screenshot_url ahora pueden ser NULL (cuando la
-- casilla fue asignada directamente por el admin, no hay reseña real detrás)
alter table public.reviews_log
  alter column google_handle drop not null,
  alter column screenshot_url drop not null,
  add column if not exists assigned_by_admin boolean not null default false;

-- 2) admin_assign_cell: asigna una casilla y la marca "verified" de inmediato
create or replace function public.admin_assign_cell(
  p_table_id uuid,
  p_cell_number int,
  p_promoter_id uuid,
  p_note text default null
) returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
  v_new_review public.reviews_log;
  v_progress public.promoter_progress;
  v_claimed_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede asignar casillas directamente.';
  end if;

  if p_cell_number is null or p_cell_number < 1 or p_cell_number > 100 then
    raise exception 'Número de casilla inválido.';
  end if;

  select * into v_table from public.bingo_tables where id = p_table_id for update;
  if not found then
    raise exception 'Ese tablero no existe.';
  end if;

  if not exists (select 1 from public.profiles where id = p_promoter_id) then
    raise exception 'Ese empleado no existe.';
  end if;

  if exists (
    select 1 from public.reviews_log
     where table_id = p_table_id and cell_number = p_cell_number and status in ('pending', 'verified')
  ) then
    raise exception 'Esa casilla ya está reclamada.';
  end if;

  insert into public.promoter_progress (promoter_id) values (p_promoter_id)
    on conflict (promoter_id) do nothing;

  update public.promoter_progress
     set verified_count = verified_count + 1, updated_at = now()
   where promoter_id = p_promoter_id
   returning * into v_progress;

  begin
    insert into public.reviews_log (
      table_id, cell_number, promoter_id, google_profile_name_raw, status,
      assigned_by_admin, verified_at, reviewed_by, counted_in_cycle
    ) values (
      p_table_id, p_cell_number, p_promoter_id,
      coalesce(nullif(trim(p_note), ''), 'Asignado directamente por el administrador'),
      'verified', true, now(), auth.uid(), v_progress.cycle_number
    ) returning * into v_new_review;
  exception when unique_violation then
    raise exception 'Esa casilla ya fue reclamada.';
  end;

  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = p_table_id and status in ('pending', 'verified');

  if v_claimed_count >= 100 then
    update public.bingo_tables set status = 'full', updated_at = now() where id = p_table_id;
  end if;

  return v_new_review;
end;
$$;
