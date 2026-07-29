-- =====================================================================
-- PARCHE 020: comprobante de pago + celular del reseñador.
--
-- 1) Al aprobar un cobro, el admin puede adjuntar una captura del pago
--    (transferencia, etc.) para que el empleado la vea en su historial
--    y confirme que ya se le pagó.
-- 2) Al reclamar una casilla, el empleado ahora también debe escribir el
--    celular de quien dejó la reseña, por si esa casilla/boleta gana el
--    sorteo y hay que contactar al ganador.
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) Comprobante de pago -------------------------------------------------

alter table public.payout_requests add column if not exists payment_proof_url text;

comment on column public.payout_requests.payment_proof_url is
  'Captura del comprobante de pago que el admin sube al aprobar, para que el empleado pueda verificar que ya se pagó.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', true, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 15728640;

drop policy if exists "payment_proofs_admin_upload" on storage.objects;
create policy "payment_proofs_admin_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-proofs' and public.is_admin());

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
         cycle_number = cycle_number + 1,
         updated_at = now()
   where promoter_id = v_payout.promoter_id;

  return v_payout;
end;
$$;

-- 2) Celular del reseñador -----------------------------------------------

alter table public.reviews_log add column if not exists reviewer_phone text;

comment on column public.reviews_log.reviewer_phone is
  'Celular de la persona que dejó la reseña, por si esa casilla/boleta resulta ganadora del sorteo. NULL cuando assigned_by_admin=true.';

create or replace function public.submit_review(
  p_table_id uuid,
  p_cell_number int,
  p_google_profile_name text,
  p_screenshot_url text,
  p_reviewer_phone text
) returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid := auth.uid();
  v_table public.bingo_tables;
  v_handle text;
  v_display_name text;
  v_new_review public.reviews_log;
  v_claimed_count int;
begin
  if v_promoter_id is null then
    raise exception 'No autenticado';
  end if;
  if public.is_promoter_suspended(v_promoter_id) then
    raise exception 'Tu cuenta está suspendida. Contacta al administrador.';
  end if;

  if p_cell_number is null or p_cell_number < 1 or p_cell_number > 100 then
    raise exception 'Número de casilla inválido.';
  end if;

  if trim(coalesce(p_screenshot_url, '')) = '' then
    raise exception 'Debes subir una captura de pantalla de la reseña.';
  end if;

  if trim(coalesce(p_reviewer_phone, '')) = '' then
    raise exception 'Debes escribir el celular de quien dejó la reseña, por si gana el premio.';
  end if;

  select * into v_table from public.bingo_tables where id = p_table_id for update;
  if not found then
    raise exception 'Ese tablero no existe.';
  end if;
  if v_table.status <> 'active' then
    raise exception 'Este tablero ya no está activo (%). Pide acceso a uno nuevo.', v_table.status;
  end if;

  if not exists (
    select 1 from public.table_access
     where table_id = p_table_id and promoter_id = v_promoter_id and status = 'approved'
  ) then
    raise exception 'No tienes acceso aprobado a este tablero.';
  end if;

  v_handle := public.normalize_google_handle(p_google_profile_name);
  v_display_name := initcap(trim(p_google_profile_name));
  if v_handle = '' then
    raise exception 'Nombre de perfil de Google inválido.';
  end if;

  if exists (
    select 1 from public.reviews_log
     where table_id = p_table_id and cell_number = p_cell_number and status in ('pending', 'verified')
  ) then
    raise exception 'Esa casilla ya fue reclamada por otro empleado. Elige otra.';
  end if;

  begin
    insert into public.reviews_log (
      table_id, cell_number, promoter_id, google_handle, google_profile_name_raw, reviewer_phone, screenshot_url, status
    ) values (
      p_table_id, p_cell_number, v_promoter_id, v_handle, v_display_name, trim(p_reviewer_phone), p_screenshot_url, 'pending'
    ) returning * into v_new_review;
  exception when unique_violation then
    raise exception 'Esa casilla ya fue reclamada por otro empleado. Elige otra.';
  end;

  insert into public.google_reviewers_registry (
    google_handle, google_profile_name_raw, promoter_id, review_log_id, status
  ) values (
    v_handle, v_display_name, v_promoter_id, v_new_review.id, 'pending'
  );

  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = p_table_id and status in ('pending', 'verified');

  if v_claimed_count >= 100 then
    update public.bingo_tables set status = 'full', updated_at = now() where id = p_table_id;
  end if;

  return v_new_review;
end;
$$;
