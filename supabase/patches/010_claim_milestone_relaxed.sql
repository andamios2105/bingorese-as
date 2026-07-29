-- =====================================================================
-- PARCHE 010: el botón de cobro ya no exige caer EXACTO en 10/30/50/70/100
-- — ahora se habilita en cuanto superas cualquiera de esos hitos, tomando
-- el más alto que ya alcanzaste. Antes, si pasabas de largo un hito (ej.
-- llegabas a 12 sin haber cobrado en 10), quedabas sin botón hasta el
-- siguiente (30). Sigue reseteando a 0 al aprobarse el pago, sin cambios.
-- =====================================================================
-- Incremental, no borra nada existente.

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
  v_milestone int;
begin
  if public.is_promoter_suspended(v_promoter_id) then
    raise exception 'Tu cuenta está suspendida. Contacta al administrador.';
  end if;

  select * into v_progress from public.promoter_progress where promoter_id = v_promoter_id for update;
  if not found then
    raise exception 'Aún no tienes reseñas verificadas.';
  end if;

  select max(m) into v_milestone
    from unnest(array[10, 30, 50, 70, 100]) as m
   where m <= v_progress.verified_count;

  if v_milestone is null then
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

  insert into public.payout_requests (
    promoter_id, cycle_number, milestone, payment_method, payment_number
  ) values (
    v_promoter_id, v_progress.cycle_number, v_milestone, v_profile.payment_method, v_profile.payment_number
  ) returning * into v_request;

  return v_request;
end;
$$;
