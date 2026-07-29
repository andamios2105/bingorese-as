-- =====================================================================
-- PARCHE 023: quita el campo "Confirmación (deben coincidir)" del panel
-- de Cobros pendientes.
--
-- Después de dos intentos de fórmula (parches 014 y 022), este número
-- seguía mostrando descuadres falsos en casos reales (reseñas sobrantes
-- de cobros parciales, datos de prueba editados a mano, etc.), obligando
-- al admin a "hacer matemáticas" cada vez que iba a pagar sin necesidad
-- real: el monto a pagar (reviews_count × rate_applied) siempre se
-- calculó correctamente en request_payout(), sin depender de este
-- número de más. Se quita por completo en vez de seguir persiguiendo
-- una fórmula perfecta para un campo que no aportaba valor real.
-- =====================================================================
-- Incremental, no borra nada existente (solo dejaba de calcular una
-- columna extra en la vista; reviews_count/rate_applied/amount siguen
-- intactos en payout_requests).

-- CREATE OR REPLACE VIEW no permite quitar/renombrar columnas (solo
-- agregar nuevas al final) — hay que borrarla y volver a crearla.
drop view if exists public.admin_payout_requests_view;

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
  pr.amount,
  pr.status,
  pr.cycle_number,
  pr.requested_at,
  pr.resolved_at,
  pr.payment_proof_url
from public.payout_requests pr
join public.profiles p on p.id = pr.promoter_id;

grant select on public.admin_payout_requests_view to authenticated;
