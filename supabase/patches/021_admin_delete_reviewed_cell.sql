-- =====================================================================
-- PARCHE 021: el admin puede borrar una casilla ya reclamada (pendiente
-- o verificada) por error propio al verificar. Libera la casilla y el
-- nombre igual que un rechazo; si ya estaba verificada, le resta 1 al
-- contador personal del empleado para que no pueda cobrarla.
--
-- Blindaje: no deja borrar una reseña que ya fue pagada en un cobro
-- anterior, ni una que esté contada en una solicitud de cobro pendiente
-- ahora mismo (primero hay que aprobar/rechazar esa solicitud) — así los
-- números de "reseñas × tarifa" vs "confirmación" del panel de cobros
-- nunca quedan desincronizados por un borrado.
-- =====================================================================
-- Incremental, no borra nada existente.

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

    update public.promoter_progress
       set verified_count = greatest(verified_count - 1, 0), updated_at = now()
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
