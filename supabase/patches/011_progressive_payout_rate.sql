-- =====================================================================
-- PARCHE 011: reemplaza los bonos fijos por hito (10=$10.000, 30=$30.000...)
-- por una TARIFA PROGRESIVA por reseña:
--   1-29 reseñas   → $800 c/u
--   30-49 reseñas  → $1.100 c/u
--   50-99 reseñas  → $1.300 c/u
--   100+ reseñas   → $1.500 c/u
-- Pago = reseñas_actuales × tarifa del rango (aplica a TODAS las reseñas
-- del ciclo, no solo a las nuevas). Sigue existiendo el mínimo de 10
-- reseñas para poder cobrar por primera vez, y el reset a 0 al aprobar.
-- =====================================================================
-- Incremental. Migra los datos existentes: las solicitudes de pago ya
-- guardadas (con milestone=10/30/50/70/100 y tarifa implícita de $1.000)
-- se preservan con reviews_count=milestone y rate_applied=1000, así el
-- monto histórico (amount) no cambia para pagos ya aprobados.

-- 0) La vista existente depende de la columna "amount" que vamos a
-- reemplazar — hay que quitarla primero (se recrea al final, paso 7).
drop view if exists public.admin_payout_requests_view;

-- 1) Columnas nuevas (nullable por ahora, para poder migrar datos)
alter table public.payout_requests
  add column if not exists reviews_count int,
  add column if not exists rate_applied numeric(12, 0);

update public.payout_requests
   set reviews_count = milestone,
       rate_applied = 1000
 where reviews_count is null;

-- 2) Quitar la columna "amount" generada (dependía de milestone) y la
-- columna "milestone" con su check
alter table public.payout_requests drop column if exists amount;
alter table public.payout_requests drop constraint if exists payout_requests_milestone_check;
alter table public.payout_requests drop column if exists milestone;

-- 3) Dejar las columnas nuevas obligatorias + recrear "amount" generada
alter table public.payout_requests
  alter column reviews_count set not null,
  alter column rate_applied set not null;

alter table public.payout_requests drop constraint if exists payout_requests_reviews_count_check;
alter table public.payout_requests add constraint payout_requests_reviews_count_check check (reviews_count >= 10);

alter table public.payout_requests add column if not exists amount numeric(12, 0)
  generated always as (reviews_count * rate_applied) stored;

-- 4) La restricción única ya no incluye "milestone" (ahora es una por ciclo)
alter table public.payout_requests
  drop constraint if exists payout_requests_promoter_id_cycle_number_milestone_key;
alter table public.payout_requests
  drop constraint if exists payout_requests_promoter_id_cycle_number_key;
alter table public.payout_requests
  add constraint payout_requests_promoter_id_cycle_number_key unique (promoter_id, cycle_number);

-- 5) Tarifa progresiva por rango
create or replace function public.payout_rate_for_count(p_count int)
returns numeric
language sql
immutable
as $$
  select case
    when p_count >= 100 then 1500
    when p_count >= 50 then 1300
    when p_count >= 30 then 1100
    else 800
  end;
$$;

-- 6) request_payout: mínimo 10 reseñas, paga reseñas_actuales × tarifa
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
    promoter_id, cycle_number, reviews_count, rate_applied, payment_method, payment_number
  ) values (
    v_promoter_id, v_progress.cycle_number, v_progress.verified_count, v_rate, v_profile.payment_method, v_profile.payment_number
  ) returning * into v_request;

  return v_request;
end;
$$;

-- 7) Vista del panel admin: reviews_count/rate_applied en vez de milestone
create or replace view public.admin_payout_requests_view as
select
  pr.id,
  pr.promoter_id,
  p.full_name,
  p.email,
  pr.payment_method,
  pr.payment_number,
  pr.reviews_count,
  pr.rate_applied,
  pr.amount,
  pr.status,
  pr.cycle_number,
  pr.requested_at,
  pr.resolved_at,
  (
    select count(*) from public.reviews_log rl
     where rl.promoter_id = pr.promoter_id
       and rl.counted_in_cycle = pr.cycle_number
       and rl.status = 'verified'
  ) as verified_reviews_in_cycle
from public.payout_requests pr
join public.profiles p on p.id = pr.promoter_id;

grant select on public.admin_payout_requests_view to authenticated;
