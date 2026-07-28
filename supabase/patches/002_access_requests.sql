-- =====================================================================
-- PARCHE 002: Solicitudes de acceso a tableros ("Postularse")
-- =====================================================================
-- Incremental, no borra nada. Agrega:
--  - status ('requested'/'approved') a table_access
--  - request_table_access(): el empleado se postula a un tablero
--  - admin_approve_table_access(): el admin aprueba una solicitud
--  - admin_grant_table_access() actualizado para funcionar con status
--  - submit_review() exige status='approved' (ya no basta con "tener fila")
--  - bingo_tables ahora es visible para cualquier empleado autenticado
--    (para que pueda ver y postularse a tableros donde aún no tiene acceso)
--  - table_grid_view exige status='approved'
-- =====================================================================

-- 1) Nuevas columnas en table_access
alter table public.table_access
  add column if not exists status text not null default 'approved' check (status in ('requested', 'approved')),
  add column if not exists approved_at timestamptz;

update public.table_access set approved_at = granted_at where approved_at is null;

alter table public.table_access rename column granted_at to requested_at;

-- 2) admin_grant_table_access: ahora hace upsert de status='approved'
create or replace function public.admin_grant_table_access(p_table_id uuid, p_promoter_email text)
returns public.table_access
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
  v_access public.table_access;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede dar acceso a un tablero.';
  end if;

  select id into v_promoter_id from public.profiles where lower(email) = lower(trim(p_promoter_email));
  if v_promoter_id is null then
    raise exception 'No existe ningún usuario registrado con el correo %.', p_promoter_email;
  end if;

  insert into public.table_access (table_id, promoter_id, status, approved_at)
  values (p_table_id, v_promoter_id, 'approved', now())
  on conflict (table_id, promoter_id) do update set status = 'approved', approved_at = now()
  returning * into v_access;

  return v_access;
end;
$$;

-- 3) request_table_access: el empleado se postula
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

-- 4) admin_approve_table_access: el admin aprueba una solicitud pendiente
create or replace function public.admin_approve_table_access(p_table_id uuid, p_promoter_id uuid)
returns public.table_access
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access public.table_access;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar solicitudes de acceso.';
  end if;

  update public.table_access
     set status = 'approved', approved_at = now()
   where table_id = p_table_id and promoter_id = p_promoter_id
   returning * into v_access;

  if not found then
    raise exception 'No existe una solicitud de ese empleado para este tablero.';
  end if;

  return v_access;
end;
$$;

-- 5) submit_review: ahora exige status='approved' (no solo "tener fila")
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

-- 6) bingo_tables: cualquier empleado autenticado puede ver la lista
-- (para poder postularse a los que no tiene acceso todavía)
drop policy if exists "tables_select_members_or_admin" on public.bingo_tables;
create policy "tables_select_authenticated" on public.bingo_tables
  for select using (auth.uid() is not null);

-- 7) table_grid_view: exige status='approved' para ver el detalle del tablero
create or replace view public.table_grid_view as
select
  rl.table_id,
  rl.cell_number,
  rl.status,
  rl.promoter_id,
  p.full_name as promoter_name
from public.reviews_log rl
join public.profiles p on p.id = rl.promoter_id
where rl.status in ('pending', 'verified')
  and (
    public.is_admin()
    or exists (
      select 1 from public.table_access ta
       where ta.table_id = rl.table_id and ta.promoter_id = auth.uid() and ta.status = 'approved'
    )
  );

grant select on public.table_grid_view to authenticated;
