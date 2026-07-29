-- =====================================================================
-- PARCHE 014: corrige la cifra de auditoría "verified_reviews_in_cycle"
-- en el panel de cobros pendientes. Antes contaba TODAS las reseñas
-- verificadas del ciclo hasta el momento de aprobar (incluyendo las que
-- se sumaron DESPUÉS de que el empleado pidiera el cobro), lo que hacía
-- parecer que se estaba pagando por más reseñas de las reales. El monto
-- a pagar (reviews_count × rate_applied) siempre estuvo bien calculado
-- — esto solo corrige el número de confirmación que se muestra al lado.
-- =====================================================================
-- Incremental, no borra nada existente — solo redefine una vista.

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
       and rl.verified_at <= pr.requested_at
  ) as verified_reviews_in_cycle
from public.payout_requests pr
join public.profiles p on p.id = pr.promoter_id;

grant select on public.admin_payout_requests_view to authenticated;
