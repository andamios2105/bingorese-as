-- =====================================================================
-- PARCHE 012: al aprobar un pago, ya no se resetea el contador a 0 a
-- ciegas — se descuenta SOLO la cantidad de reseñas que estaban incluidas
-- en esa solicitud. Si el empleado sumó reseñas nuevas después de pedir
-- el cobro (y antes de que el admin lo aprobara), esas quedan a su favor
-- en el nuevo ciclo en vez de perderse.
-- =====================================================================
-- Incremental, no borra nada existente.

create or replace function public.admin_approve_payout(p_payout_id uuid)
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
     set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
   where id = p_payout_id
   returning * into v_payout;

  update public.promoter_progress
     set verified_count = greatest(verified_count - v_payout.reviews_count, 0),
         cycle_number = cycle_number + 1,
         updated_at = now()
   where promoter_id = v_payout.promoter_id;

  return v_payout;
end;
$$;
