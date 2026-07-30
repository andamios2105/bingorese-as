-- =====================================================================
-- PARCHE 024: bono extra por reseña, configurable por tablero.
--
-- El admin puede fijar (al crear o editar un tablero) un bono en COP que
-- se suma a la tarifa progresiva normal por CADA reseña verificada de
-- ese tablero específico — para incentivar a los empleados a llenarlo
-- más rápido. Se ve destacado en la tarjeta del tablero (empleado y
-- admin) y se suma automáticamente al monto a cobrar.
--
-- Funciona con el mismo patrón robusto que ya usa verified_count: se
-- acumula en promoter_progress.bonus_balance al aprobar cada reseña, se
-- congela en payout_requests.bonus_amount al pedir el cobro, y se resta
-- SOLO lo pagado al aprobar (igual que con verified_count).
-- =====================================================================
-- Incremental, no borra nada existente.

-- 0) La vista depende de payout_requests.amount, que vamos a recrear con
-- una fórmula nueva — hay que borrarla primero (se recrea al final).
drop view if exists public.admin_payout_requests_view;

-- 1) Columna nueva en bingo_tables (la validación >= 0 ya la hacen las
-- funciones admin_create_table/admin_update_table_details más abajo).
alter table public.bingo_tables add column if not exists bonus_rate numeric(12, 0) not null default 0;

comment on column public.bingo_tables.bonus_rate is
  'Bono extra en COP que se suma por cada reseña verificada de este tablero, encima de la tarifa progresiva normal.';

-- 2) Columna nueva en promoter_progress
alter table public.promoter_progress add column if not exists bonus_balance numeric(12, 0) not null default 0;

-- 3) payout_requests: agrega bonus_amount y recalcula "amount" para
-- incluirlo (amount es una columna generada, hay que recrearla).
alter table public.payout_requests add column if not exists bonus_amount numeric(12, 0) not null default 0;
alter table public.payout_requests drop column if exists amount;
alter table public.payout_requests
  add column amount numeric(12, 0) generated always as (reviews_count * rate_applied + bonus_amount) stored;

-- 4) admin_create_table: ahora también recibe el bono del tablero.
create or replace function public.admin_create_table(
  p_name text,
  p_business_name text default null,
  p_google_maps_url text default null,
  p_prize text default null,
  p_lottery_name text default null,
  p_draw_date date default null,
  p_keyword text default null,
  p_bonus_rate numeric default 0
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
  if coalesce(p_bonus_rate, 0) < 0 then
    raise exception 'El bono extra no puede ser negativo.';
  end if;

  insert into public.bingo_tables (
    name, business_name, google_maps_url, prize, lottery_name, draw_date, keyword, bonus_rate, created_by
  ) values (
    initcap(trim(p_name)),
    nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
    nullif(trim(coalesce(p_google_maps_url, '')), ''),
    nullif(initcap(trim(coalesce(p_prize, ''))), ''),
    nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
    p_draw_date,
    nullif(trim(coalesce(p_keyword, '')), ''),
    coalesce(p_bonus_rate, 0),
    auth.uid()
  )
  returning * into v_table;

  return v_table;
end;
$$;

-- 5) admin_update_table_details: ahora también actualiza el bono.
create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
  p_business_name text,
  p_google_maps_url text,
  p_prize text,
  p_lottery_name text,
  p_draw_date date,
  p_keyword text default null,
  p_bonus_rate numeric default 0
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
  if coalesce(p_bonus_rate, 0) < 0 then
    raise exception 'El bono extra no puede ser negativo.';
  end if;

  update public.bingo_tables
     set name = initcap(trim(p_name)),
         business_name = nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
         google_maps_url = nullif(trim(coalesce(p_google_maps_url, '')), ''),
         prize = nullif(initcap(trim(coalesce(p_prize, ''))), ''),
         lottery_name = nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
         draw_date = p_draw_date,
         keyword = nullif(trim(coalesce(p_keyword, '')), ''),
         bonus_rate = coalesce(p_bonus_rate, 0),
         updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;

-- 6) admin_approve_review: suma el bono del tablero al aprobar.
create or replace function public.admin_approve_review(p_review_id uuid)
returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews_log;
  v_progress public.promoter_progress;
  v_bonus_rate numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar reseñas.';
  end if;

  select * into v_review from public.reviews_log where id = p_review_id for update;
  if not found then
    raise exception 'Reseña no encontrada.';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'Esta reseña ya fue procesada (estado actual: %).', v_review.status;
  end if;

  select bonus_rate into v_bonus_rate from public.bingo_tables where id = v_review.table_id;

  insert into public.promoter_progress (promoter_id) values (v_review.promoter_id)
    on conflict (promoter_id) do nothing;

  update public.promoter_progress
     set verified_count = verified_count + 1,
         bonus_balance = bonus_balance + coalesce(v_bonus_rate, 0),
         updated_at = now()
   where promoter_id = v_review.promoter_id
   returning * into v_progress;

  update public.reviews_log
     set status = 'verified', verified_at = now(), reviewed_by = auth.uid(), counted_in_cycle = v_progress.cycle_number
   where id = p_review_id
   returning * into v_review;

  update public.google_reviewers_registry set status = 'verified' where review_log_id = p_review_id;

  return v_review;
end;
$$;

-- 7) admin_assign_cell: también suma el bono si aplica.
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
     set verified_count = verified_count + 1,
         bonus_balance = bonus_balance + coalesce(v_table.bonus_rate, 0),
         updated_at = now()
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

-- 8) request_payout: congela el bono acumulado en la solicitud.
create or replace function public.request_payout()
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid := auth.uid();
  v_progress public.promoter_progress;
  v_profile public.profiles;
  v_request public.payout_requests;
  v_rate numeric;
begin
  if public.is_promoter_suspended(v_promoter_id) then
    raise exception 'Tu cuenta está suspendida. Contacta al administrador.';
  end if;

  select * into v_progress from public.promoter_progress where promoter_id = v_promoter_id for update;
  if not found then
    raise exception 'Aún no tienes reseñas verificadas.';
  end if;

  if v_progress.verified_count < 10 then
    raise exception 'Necesitas al menos 10 reseñas verificadas para poder cobrar. Llevas %.', v_progress.verified_count;
  end if;

  if exists (
    select 1 from public.payout_requests
     where promoter_id = v_promoter_id and cycle_number = v_progress.cycle_number and status = 'pending'
  ) then
    raise exception 'Ya tienes una solicitud de cobro pendiente para este ciclo.';
  end if;

  select * into v_profile from public.profiles where id = v_promoter_id;
  if v_profile.payment_method is null or v_profile.payment_number is null then
    raise exception 'Debes registrar tu método de pago (Nequi/Daviplata) antes de reclamar.';
  end if;

  v_rate := public.payout_rate_for_count(v_progress.verified_count);

  insert into public.payout_requests (
    promoter_id, cycle_number, reviews_count, rate_applied, bonus_amount, payment_method, payment_number
  ) values (
    v_promoter_id, v_progress.cycle_number, v_progress.verified_count, v_rate, v_progress.bonus_balance,
    v_profile.payment_method, v_profile.payment_number
  ) returning * into v_request;

  return v_request;
end;
$$;

-- 9) admin_approve_payout: descuenta SOLO el bono que se pagó.
create or replace function public.admin_approve_payout(p_payout_id uuid, p_payment_proof_url text default null)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payout_requests;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar pagos.';
  end if;

  select * into v_payout from public.payout_requests where id = p_payout_id for update;
  if not found then
    raise exception 'Solicitud de pago no encontrada.';
  end if;
  if v_payout.status <> 'pending' then
    raise exception 'Esta solicitud ya fue procesada (estado actual: %).', v_payout.status;
  end if;

  update public.payout_requests
     set status = 'approved',
         resolved_at = now(),
         resolved_by = auth.uid(),
         payment_proof_url = nullif(trim(coalesce(p_payment_proof_url, '')), '')
   where id = p_payout_id
   returning * into v_payout;

  update public.promoter_progress
     set verified_count = greatest(verified_count - v_payout.reviews_count, 0),
         bonus_balance = greatest(bonus_balance - v_payout.bonus_amount, 0),
         cycle_number = cycle_number + 1,
         updated_at = now()
   where promoter_id = v_payout.promoter_id;

  return v_payout;
end;
$$;

-- 10) admin_delete_reviewed_cell: también deshace el bono si aplicaba.
create or replace function public.admin_delete_reviewed_cell(p_review_id uuid, p_reason text default null)
returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews_log;
  v_progress public.promoter_progress;
  v_claimed_count int;
  v_bonus_rate numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar una casilla.';
  end if;

  select * into v_review from public.reviews_log where id = p_review_id for update;
  if not found then
    raise exception 'Reseña no encontrada.';
  end if;
  if v_review.status = 'rejected' then
    raise exception 'Esta casilla ya estaba rechazada/eliminada.';
  end if;

  if v_review.status = 'verified' then
    insert into public.promoter_progress (promoter_id) values (v_review.promoter_id)
      on conflict (promoter_id) do nothing;

    select * into v_progress from public.promoter_progress where promoter_id = v_review.promoter_id for update;

    if v_review.counted_in_cycle is distinct from v_progress.cycle_number then
      raise exception
        'Esta reseña ya fue pagada en un cobro anterior — no se puede borrar así. Corrígelo manualmente si es necesario.';
    end if;

    if exists (
      select 1 from public.payout_requests
       where promoter_id = v_review.promoter_id and cycle_number = v_progress.cycle_number and status = 'pending'
    ) then
      raise exception
        'Este empleado tiene una solicitud de cobro pendiente que ya cuenta esta reseña. Apruébala o recházala primero, y luego borra la casilla.';
    end if;

    select bonus_rate into v_bonus_rate from public.bingo_tables where id = v_review.table_id;

    update public.promoter_progress
       set verified_count = greatest(verified_count - 1, 0),
           bonus_balance = greatest(bonus_balance - coalesce(v_bonus_rate, 0), 0),
           updated_at = now()
     where promoter_id = v_review.promoter_id;
  end if;

  update public.reviews_log
     set status = 'rejected',
         rejected_at = now(),
         reviewed_by = auth.uid(),
         rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Eliminada por el administrador')
   where id = p_review_id
   returning * into v_review;

  delete from public.google_reviewers_registry where review_log_id = p_review_id;

  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = v_review.table_id and status in ('pending', 'verified');

  update public.bingo_tables
     set status = 'active', updated_at = now()
   where id = v_review.table_id and status = 'full' and v_claimed_count < 100;

  return v_review;
end;
$$;

-- 11) Recrea la vista de cobros pendientes con bonus_amount incluido.
create view public.admin_payout_requests_view as
select
  pr.id,
  pr.promoter_id,
  p.full_name,
  p.email,
  pr.payment_method,
  pr.payment_number,
  pr.reviews_count,
  pr.rate_applied,
  pr.bonus_amount,
  pr.amount,
  pr.status,
  pr.cycle_number,
  pr.requested_at,
  pr.resolved_at,
  pr.payment_proof_url
from public.payout_requests pr
join public.profiles p on p.id = pr.promoter_id;

grant select on public.admin_payout_requests_view to authenticated;
