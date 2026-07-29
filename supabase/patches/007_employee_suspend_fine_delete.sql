-- =====================================================================
-- PARCHE 007: gestión de empleados — suspender (indefinido), multar
-- (suspensión temporal por X días con motivo), y borrar (solo sin historial)
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) Nuevas columnas en profiles
alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_until timestamptz;

-- 2) Tabla de auditoría de multas
create table if not exists public.fines_log (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.profiles (id) on delete cascade,
  days int not null check (days > 0),
  reason text not null,
  applied_by uuid not null references public.profiles (id),
  applied_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.fines_log enable row level security;

drop policy if exists "fines_select_own_or_admin" on public.fines_log;
create policy "fines_select_own_or_admin" on public.fines_log
  for select using (promoter_id = auth.uid() or public.is_admin());

-- 3) Helper: ¿está suspendido (indefinido o multa vigente)?
create or replace function public.is_promoter_suspended(p_promoter_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_suspended or (suspended_until is not null and suspended_until > now())
       from public.profiles where id = p_promoter_id),
    false
  );
$$;

-- 4) admin_suspend_promoter / admin_reactivate_promoter
create or replace function public.admin_suspend_promoter(p_promoter_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede suspender empleados.';
  end if;

  update public.profiles
     set is_suspended = true, updated_at = now()
   where id = p_promoter_id and role = 'promoter'
   returning * into v_profile;

  if not found then
    raise exception 'Empleado no encontrado.';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_reactivate_promoter(p_promoter_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede reactivar empleados.';
  end if;

  update public.profiles
     set is_suspended = false, suspended_until = null, updated_at = now()
   where id = p_promoter_id and role = 'promoter'
   returning * into v_profile;

  if not found then
    raise exception 'Empleado no encontrado.';
  end if;

  return v_profile;
end;
$$;

-- 5) admin_fine_promoter: suspensión temporal por X días
create or replace function public.admin_fine_promoter(p_promoter_id uuid, p_days int, p_reason text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_expires_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede multar empleados.';
  end if;
  if p_days is null or p_days <= 0 then
    raise exception 'El número de días debe ser mayor a 0.';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'La multa necesita un motivo.';
  end if;
  if not exists (select 1 from public.profiles where id = p_promoter_id and role = 'promoter') then
    raise exception 'Empleado no encontrado.';
  end if;

  v_expires_at := now() + (p_days || ' days')::interval;

  update public.profiles
     set suspended_until = v_expires_at, updated_at = now()
   where id = p_promoter_id
   returning * into v_profile;

  insert into public.fines_log (promoter_id, days, reason, applied_by, expires_at)
  values (p_promoter_id, p_days, trim(p_reason), auth.uid(), v_expires_at);

  return v_profile;
end;
$$;

-- 6) admin_delete_promoter: solo si NO tiene historial
create or replace function public.admin_delete_promoter(p_promoter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar empleados.';
  end if;

  select
    (select count(*) from public.reviews_log where promoter_id = p_promoter_id) +
    (select count(*) from public.payout_requests where promoter_id = p_promoter_id)
  into v_history_count;

  if v_history_count > 0 then
    raise exception 'Este empleado ya tiene reseñas o pagos registrados — suspéndelo en vez de borrarlo para no perder el historial.';
  end if;

  delete from public.table_access where promoter_id = p_promoter_id;
  delete from public.promoter_progress where promoter_id = p_promoter_id;
  delete from public.fines_log where promoter_id = p_promoter_id;
  delete from public.profiles where id = p_promoter_id and role = 'promoter';
end;
$$;

-- 7) Bloquear acciones de empleados suspendidos en las funciones que ya usan
create or replace function public.request_table_access(p_table_id uuid)
returns public.table_access
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_table public.bingo_tables;
  v_access public.table_access;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if public.is_promoter_suspended(v_uid) then
    raise exception 'Tu cuenta está suspendida. Contacta al administrador.';
  end if;

  select * into v_table from public.bingo_tables where id = p_table_id;
  if not found then
    raise exception 'Ese tablero no existe.';
  end if;
  if v_table.status <> 'active' then
    raise exception 'Este tablero ya no está activo.';
  end if;

  if exists (select 1 from public.table_access where table_id = p_table_id and promoter_id = v_uid) then
    raise exception 'Ya tienes una solicitud o acceso a este tablero.';
  end if;

  insert into public.table_access (table_id, promoter_id, status, approved_at)
  values (p_table_id, v_uid, 'requested', null)
  returning * into v_access;

  return v_access;
end;
$$;

create or replace function public.submit_review(
  p_table_id uuid,
  p_cell_number int,
  p_google_profile_name text,
  p_screenshot_url text
) returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid := auth.uid();
  v_table public.bingo_tables;
  v_handle text;
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
  if v_handle = '' then
    raise exception 'Nombre de perfil de Google inválido.';
  end if;
  if exists (select 1 from public.google_reviewers_registry where google_handle = v_handle) then
    raise exception 'Este perfil de Google ya registró una reseña en el sistema anteriormente.';
  end if;

  if exists (
    select 1 from public.reviews_log
     where table_id = p_table_id and cell_number = p_cell_number and status in ('pending', 'verified')
  ) then
    raise exception 'Esa casilla ya fue reclamada por otro empleado. Elige otra.';
  end if;

  begin
    insert into public.reviews_log (
      table_id, cell_number, promoter_id, google_handle, google_profile_name_raw, screenshot_url, status
    ) values (
      p_table_id, p_cell_number, v_promoter_id, v_handle, trim(p_google_profile_name), p_screenshot_url, 'pending'
    ) returning * into v_new_review;
  exception when unique_violation then
    raise exception 'Esa casilla ya fue reclamada por otro empleado. Elige otra.';
  end;

  insert into public.google_reviewers_registry (
    google_handle, google_profile_name_raw, promoter_id, review_log_id, status
  ) values (
    v_handle, trim(p_google_profile_name), v_promoter_id, v_new_review.id, 'pending'
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
begin
  if public.is_promoter_suspended(v_promoter_id) then
    raise exception 'Tu cuenta está suspendida. Contacta al administrador.';
  end if;

  select * into v_progress from public.promoter_progress where promoter_id = v_promoter_id for update;
  if not found then
    raise exception 'Aún no tienes reseñas verificadas.';
  end if;

  if v_progress.verified_count not in (10, 30, 50, 70, 100) then
    raise exception 'Solo puedes reclamar el pago al llegar exactamente a 10, 30, 50, 70 o 100 reseñas verificadas. Llevas %.', v_progress.verified_count;
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
    v_promoter_id, v_progress.cycle_number, v_progress.verified_count, v_profile.payment_method, v_profile.payment_number
  ) returning * into v_request;

  return v_request;
end;
$$;
