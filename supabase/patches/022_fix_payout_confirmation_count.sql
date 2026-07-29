-- =====================================================================
-- PARCHE 022: arregla el número de "confirmación" en Cobros pendientes,
-- que podía mostrarse más bajo de lo real (ej. 13 en vez de 15) aunque
-- TODAS las reseñas del empleado estuvieran verificadas.
--
-- Causa: la vista filtraba por counted_in_cycle = cycle_number actual.
-- Pero counted_in_cycle queda fijo en cada reseña desde que se verificó
-- (con el número de ciclo de ESE momento) y nunca se actualiza. Si un
-- cobro anterior se pagó de forma PARCIAL (dejando reseñas "sobrantes"
-- a favor del empleado, a propósito, para no perderlas — parche 012),
-- esas reseñas sobrantes quedan con el ciclo viejo para siempre, aunque
-- sigan sumando al total actual del empleado. El filtro por ciclo las
-- excluía por error, mostrando un número más bajo de lo real.
--
-- Arreglo: en vez de filtrar por ciclo, se cuentan TODAS las reseñas
-- verificadas del empleado hasta el momento de pedir el cobro, y se les
-- resta lo que ya se le pagó en cobros aprobados anteriores. Así el
-- número de confirmación siempre coincide con reviews_count cuando todo
-- está en orden, sin depender de una etiqueta de ciclo que puede quedar
-- desactualizada.
-- =====================================================================
-- Incremental, no borra nada existente.

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
    select
      (select count(*) from public.reviews_log rl
        where rl.promoter_id = pr.promoter_id
          and rl.status = 'verified'
          and rl.verified_at <= pr.requested_at)
      -
      (select coalesce(sum(prev.reviews_count), 0) from public.payout_requests prev
        where prev.promoter_id = pr.promoter_id
          and prev.status = 'approved'
          and prev.resolved_at <= pr.requested_at)
  ) as verified_reviews_in_cycle
from public.payout_requests pr
join public.profiles p on p.id = pr.promoter_id;

grant select on public.admin_payout_requests_view to authenticated;
