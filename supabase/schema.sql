-- =====================================================================
-- BINGO DE RESEÑAS — Esquema de Base de Datos v2 (PostgreSQL / Supabase)
-- =====================================================================
-- Modelo v2: TABLEROS COMPARTIDOS. El admin crea "tableros" (bingo_tables)
-- de 100 casillas y le da acceso a empleados específicos (table_access).
-- Todos los empleados con acceso a un tablero ven las MISMAS 100 casillas
-- y compiten por ellas: si el empleado A reclama la #23, ningún otro
-- empleado puede tomar esa misma casilla en ese tablero (UNIQUE parcial
-- sobre table_id+cell_number). El progreso hacia el pago (10/30/50/70/100)
-- es un contador personal por empleado (promoter_progress), acumulado
-- entre TODOS los tableros en los que participa, y se resetea solo para
-- él cuando le aprueban un pago — el tablero compartido nunca se resetea,
-- solo se marca "full" cuando ya no quedan casillas libres.
--
-- Ejecutar completo en el SQL Editor de Supabase. Es seguro re-ejecutar:
-- dropea primero los objetos de la v1 que cambiaron de estructura.
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "unaccent";  -- usado por normalize_google_handle()

-- ---------------------------------------------------------------------
-- 0. LIMPIEZA DE OBJETOS v1 QUE CAMBIARON DE ESTRUCTURA
-- ---------------------------------------------------------------------
drop view if exists public.admin_payout_requests_view;
drop view if exists public.table_grid_view;
drop function if exists public.admin_approve_payout(uuid);
drop function if exists public.admin_reject_payout(uuid, text);
drop function if exists public.request_payout();
drop function if exists public.admin_reject_review(uuid, text);
drop function if exists public.admin_approve_review(uuid);
drop function if exists public.submit_review(text, text);
drop function if exists public.ensure_bingo_setup();
drop table if exists public.payout_requests cascade;
drop table if exists public.reviews_log cascade;
drop table if exists public.google_reviewers_registry cascade;
drop table if exists public.bingo_cards cascade;
drop table if exists public.table_access cascade;
drop table if exists public.bingo_tables cascade;
drop table if exists public.promoter_progress cascade;
drop table if exists public.app_settings cascade;

-- ---------------------------------------------------------------------
-- 1. PROFILES (extiende auth.users de Supabase) — sin cambios en v2
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  payment_method text check (payment_method in ('nequi', 'daviplata', 'bancolombia', 'otro')),
  payment_number text,
  role text not null default 'promoter' check (role in ('promoter', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de usuario (empleado/promotor o admin). 1:1 con auth.users.';

-- ---------------------------------------------------------------------
-- 2. BINGO_TABLES — tableros compartidos de 100 casillas, creados por el admin
-- ---------------------------------------------------------------------
create table public.bingo_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'full', 'archived')),
  prize text,
  lottery_name text,
  draw_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bingo_tables is
  'Tablero compartido de 100 casillas. Se marca "full" automáticamente cuando las 100 casillas quedan reclamadas (pending o verified). El admin crea uno nuevo manualmente cuando eso pasa.';

-- ---------------------------------------------------------------------
-- 3. TABLE_ACCESS — a qué empleados el admin les dio acceso a cada tablero
-- ---------------------------------------------------------------------
create table public.table_access (
  table_id uuid not null references public.bingo_tables (id) on delete cascade,
  promoter_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'approved' check (status in ('requested', 'approved')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  primary key (table_id, promoter_id)
);

comment on table public.table_access is
  'Relación muchos-a-muchos: qué empleados pueden ver/reclamar casillas en qué tablero. status=requested es una solicitud del empleado pendiente de aprobación; status=approved es acceso real (otorgado directo por el admin o aprobado desde una solicitud).';

-- ---------------------------------------------------------------------
-- 4. PROMOTER_PROGRESS — contador personal de cada empleado hacia su pago
-- ---------------------------------------------------------------------
create table public.promoter_progress (
  promoter_id uuid primary key references public.profiles (id) on delete cascade,
  verified_count int not null default 0 check (verified_count >= 0),
  cycle_number int not null default 1 check (cycle_number >= 1),
  updated_at timestamptz not null default now()
);

comment on table public.promoter_progress is
  'Progreso personal del empleado hacia el próximo hito de pago (10/30/50/70/100), acumulado entre TODOS los tableros. Se resetea a 0 (y cycle_number+1) solo para este empleado cuando se le aprueba un pago.';

-- ---------------------------------------------------------------------
-- 5. GOOGLE_REVIEWERS_REGISTRY — candado global anti-duplicados por nombre
-- ---------------------------------------------------------------------
-- Solo contiene handles en estado 'pending' o 'verified'. Si una reseña
-- es rechazada, su fila se BORRA de aquí (libera el nombre). Si es
-- aprobada, la fila queda para siempre bloqueando ese perfil de Google.
create table public.google_reviewers_registry (
  id uuid primary key default gen_random_uuid(),
  google_handle text not null unique, -- normalizado: minúsculas, sin espacios/símbolos
  google_profile_name_raw text not null,
  promoter_id uuid not null references public.profiles (id),
  review_log_id uuid not null,
  status text not null check (status in ('pending', 'verified')),
  registered_at timestamptz not null default now()
);

comment on table public.google_reviewers_registry is
  'Registro global de perfiles de Google que ya reseñaron. UNIQUE(google_handle) es el blindaje central anti-duplicados (Regla 2.a), sin importar en qué tablero ni qué empleado.';

-- ---------------------------------------------------------------------
-- 6. REVIEWS_LOG — cada casilla reclamada en cualquier tablero
-- ---------------------------------------------------------------------
create table public.reviews_log (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.bingo_tables (id),
  cell_number int not null check (cell_number between 1 and 100),
  promoter_id uuid not null references public.profiles (id),
  -- google_handle/screenshot_url son NULL cuando assigned_by_admin=true
  -- (el admin asignó la casilla directamente, sin una reseña real detrás).
  google_handle text,
  google_profile_name_raw text not null,
  screenshot_url text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  assigned_by_admin boolean not null default false,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  rejected_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  -- Cycle de promoter_progress en el que quedó contabilizada esta reseña
  -- al momento de aprobarse (para el desglose de cada solicitud de pago):
  counted_in_cycle int
);

alter table public.google_reviewers_registry
  add constraint google_reviewers_registry_review_log_id_fkey
  foreign key (review_log_id) references public.reviews_log (id) on delete cascade;

-- Blindaje real anti-doble-reclamo: una casilla activa (pending/verified)
-- solo puede existir UNA vez por tablero. Si se rechaza, deja de contar
-- aquí (status ya no es pending/verified) y la casilla queda libre.
create unique index reviews_log_table_cell_active_uidx
  on public.reviews_log (table_id, cell_number)
  where status in ('pending', 'verified');

create index reviews_log_table_idx on public.reviews_log (table_id, status);
create index reviews_log_promoter_idx on public.reviews_log (promoter_id);

comment on table public.reviews_log is
  'Cada casilla reclamada en un tablero compartido. No se edita ni se borra tras rechazo: se marca "rejected" para auditoría, y libera la casilla + el nombre de Google para un nuevo intento.';

-- ---------------------------------------------------------------------
-- 7. PAYOUT_REQUESTS — solicitudes/histórico de cobro por empleado
-- ---------------------------------------------------------------------
create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.profiles (id),
  cycle_number int not null,
  milestone int not null check (milestone in (10, 30, 50, 70, 100)),
  amount numeric(12, 0) generated always as (milestone * 1000) stored,
  payment_method text not null,
  payment_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  -- Un mismo empleado no puede pedir el mismo hito dos veces en el mismo ciclo:
  unique (promoter_id, cycle_number, milestone)
);

create index payout_requests_status_idx on public.payout_requests (status);

comment on table public.payout_requests is
  'Solicitudes de cobro por hito (10/30/50/70/100) por empleado. Al aprobar, se resetea el progreso personal de ESE empleado (promoter_progress), sin afectar los tableros compartidos.';

-- ---------------------------------------------------------------------
-- 8. APP_SETTINGS — link fijo del negocio en Google Maps (para que el
--    admin lo use al verificar reseñas contra la captura de pantalla)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  google_business_reviews_url text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

comment on table public.app_settings is
  'Fila única de configuración global. google_business_reviews_url es el link FIJO al listado de reseñas del negocio en Google Maps (no cambia por reseña) — el admin lo abre y busca con Ctrl+F para verificar cada captura.';

-- =====================================================================
-- FUNCIONES DE NEGOCIO (SECURITY DEFINER) — el corazón anti-fraude
-- =====================================================================
-- Se ejecutan con privilegios elevados y son la ÚNICA vía permitida para
-- mutar estas tablas desde el cliente. Esto impide que un empleado
-- manipule su contador, reclame casillas ya tomadas, o se auto-otorgue
-- acceso/rol de administrador.

create or replace function public.normalize_google_handle(raw text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(unaccent(trim(raw))), '[^a-z0-9]', '', 'g');
$$;

-- ---------------------------------------------------------------------
-- is_admin: helper usado tanto por RLS como por las funciones de abajo
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- admin_create_table: crea un tablero nuevo de 100 casillas
-- ---------------------------------------------------------------------
create or replace function public.admin_create_table(p_name text)
returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear tableros.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'El tablero necesita un nombre.';
  end if;

  insert into public.bingo_tables (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_table;

  return v_table;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_update_table_details: edita nombre/premio/lotería/fecha de juego
-- ---------------------------------------------------------------------
create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
  p_prize text,
  p_lottery_name text,
  p_draw_date date
) returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar tableros.';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'El tablero necesita un nombre.';
  end if;

  update public.bingo_tables
     set name = trim(p_name),
         prize = nullif(trim(coalesce(p_prize, '')), ''),
         lottery_name = nullif(trim(coalesce(p_lottery_name, '')), ''),
         draw_date = p_draw_date,
         updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_set_table_status: pausar / reanudar / archivar (no permite forzar
-- "full", ese estado solo lo pone submit_review automáticamente)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_table_status(p_table_id uuid, p_status text)
returns public.bingo_tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de un tablero.';
  end if;
  if p_status not in ('active', 'paused', 'archived') then
    raise exception 'Estado inválido: %.', p_status;
  end if;

  update public.bingo_tables
     set status = p_status, updated_at = now()
   where id = p_table_id
   returning * into v_table;

  if not found then
    raise exception 'Tablero no encontrado.';
  end if;

  return v_table;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_delete_table: solo permite borrar tableros SIN reseñas registradas
-- (si ya tiene historial, se debe archivar en vez de borrar, para no
-- perder el rastro de auditoría ni las reseñas ya contadas en pagos).
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar un tablero.';
  end if;

  select count(*) into v_claimed_count from public.reviews_log where table_id = p_table_id;
  if v_claimed_count > 0 then
    raise exception 'Este tablero ya tiene reseñas registradas — archívalo en vez de borrarlo para no perder el historial.';
  end if;

  delete from public.table_access where table_id = p_table_id;
  delete from public.bingo_tables where id = p_table_id;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_grant_table_access / admin_revoke_table_access
-- ---------------------------------------------------------------------
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

create or replace function public.admin_revoke_table_access(p_table_id uuid, p_promoter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede quitar o rechazar el acceso a un tablero.';
  end if;

  delete from public.table_access where table_id = p_table_id and promoter_id = p_promoter_id;
end;
$$;

-- ---------------------------------------------------------------------
-- request_table_access: el empleado se "postula" a un tablero activo
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- admin_approve_table_access: aprueba una solicitud pendiente de acceso
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- admin_update_app_settings: fija el link del negocio en Google Maps
-- ---------------------------------------------------------------------
create or replace function public.admin_update_app_settings(p_google_business_reviews_url text)
returns public.app_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.app_settings;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar la configuración.';
  end if;

  update public.app_settings
     set google_business_reviews_url = trim(p_google_business_reviews_url), updated_at = now()
   where id = true
   returning * into v_settings;

  return v_settings;
end;
$$;

-- ---------------------------------------------------------------------
-- submit_review: reclama una casilla específica de un tablero para el
-- empleado autenticado, con todas las validaciones anti-fraude.
-- ---------------------------------------------------------------------
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

  -- Candado global anti-duplicados por nombre de perfil (Regla 2.a)
  v_handle := public.normalize_google_handle(p_google_profile_name);
  if v_handle = '' then
    raise exception 'Nombre de perfil de Google inválido.';
  end if;
  if exists (select 1 from public.google_reviewers_registry where google_handle = v_handle) then
    raise exception 'Este perfil de Google ya registró una reseña en el sistema anteriormente.';
  end if;

  -- Blindaje anti-doble-reclamo de la misma casilla (el UNIQUE index es la
  -- garantía real; este pre-chequeo solo da un mensaje amigable).
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

  -- Si esta era la casilla 100, el tablero queda lleno: el admin deberá
  -- crear uno nuevo (Regla acordada: sin auto-reinicio del tablero).
  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = p_table_id and status in ('pending', 'verified');

  if v_claimed_count >= 100 then
    update public.bingo_tables set status = 'full', updated_at = now() where id = p_table_id;
  end if;

  return v_new_review;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_assign_cell: el admin reclama una casilla directamente para un
-- empleado, sin pasar por reseña/captura/verificación (queda "verified"
-- de una vez). Útil para regalar un número manualmente.
-- ---------------------------------------------------------------------
create or replace function public.admin_assign_cell(
  p_table_id uuid,
  p_cell_number int,
  p_promoter_id uuid,
  p_note text default null
) returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.bingo_tables;
  v_new_review public.reviews_log;
  v_progress public.promoter_progress;
  v_claimed_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede asignar casillas directamente.';
  end if;

  if p_cell_number is null or p_cell_number < 1 or p_cell_number > 100 then
    raise exception 'Número de casilla inválido.';
  end if;

  select * into v_table from public.bingo_tables where id = p_table_id for update;
  if not found then
    raise exception 'Ese tablero no existe.';
  end if;

  if not exists (select 1 from public.profiles where id = p_promoter_id) then
    raise exception 'Ese empleado no existe.';
  end if;

  if exists (
    select 1 from public.reviews_log
     where table_id = p_table_id and cell_number = p_cell_number and status in ('pending', 'verified')
  ) then
    raise exception 'Esa casilla ya está reclamada.';
  end if;

  insert into public.promoter_progress (promoter_id) values (p_promoter_id)
    on conflict (promoter_id) do nothing;

  update public.promoter_progress
     set verified_count = verified_count + 1, updated_at = now()
   where promoter_id = p_promoter_id
   returning * into v_progress;

  begin
    insert into public.reviews_log (
      table_id, cell_number, promoter_id, google_profile_name_raw, status,
      assigned_by_admin, verified_at, reviewed_by, counted_in_cycle
    ) values (
      p_table_id, p_cell_number, p_promoter_id,
      coalesce(nullif(trim(p_note), ''), 'Asignado directamente por el administrador'),
      'verified', true, now(), auth.uid(), v_progress.cycle_number
    ) returning * into v_new_review;
  exception when unique_violation then
    raise exception 'Esa casilla ya fue reclamada.';
  end;

  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = p_table_id and status in ('pending', 'verified');

  if v_claimed_count >= 100 then
    update public.bingo_tables set status = 'full', updated_at = now() where id = p_table_id;
  end if;

  return v_new_review;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_approve_review: verifica la reseña y suma al progreso del empleado
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_review(p_review_id uuid)
returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews_log;
  v_progress public.promoter_progress;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar reseñas.';
  end if;

  select * into v_review from public.reviews_log where id = p_review_id for update;
  if not found then
    raise exception 'Reseña no encontrada.';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'Esta reseña ya fue procesada (estado actual: %).', v_review.status;
  end if;

  insert into public.promoter_progress (promoter_id) values (v_review.promoter_id)
    on conflict (promoter_id) do nothing;

  update public.promoter_progress
     set verified_count = verified_count + 1, updated_at = now()
   where promoter_id = v_review.promoter_id
   returning * into v_progress;

  update public.reviews_log
     set status = 'verified', verified_at = now(), reviewed_by = auth.uid(), counted_in_cycle = v_progress.cycle_number
   where id = p_review_id
   returning * into v_review;

  update public.google_reviewers_registry set status = 'verified' where review_log_id = p_review_id;

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_reject_review: libera la casilla y el nombre (Regla 2.c)
-- ---------------------------------------------------------------------
create or replace function public.admin_reject_review(p_review_id uuid, p_reason text)
returns public.reviews_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews_log;
  v_claimed_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede rechazar reseñas.';
  end if;

  select * into v_review from public.reviews_log where id = p_review_id for update;
  if not found then
    raise exception 'Reseña no encontrada.';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'Esta reseña ya fue procesada (estado actual: %).', v_review.status;
  end if;

  update public.reviews_log
     set status = 'rejected', rejected_at = now(), reviewed_by = auth.uid(), rejection_reason = p_reason
   where id = p_review_id
   returning * into v_review;

  delete from public.google_reviewers_registry where review_log_id = p_review_id;

  -- La casilla vuelve a estar libre: si el tablero estaba "full", reabre.
  select count(*) into v_claimed_count
    from public.reviews_log
   where table_id = v_review.table_id and status in ('pending', 'verified');

  update public.bingo_tables
     set status = 'active', updated_at = now()
   where id = v_review.table_id and status = 'full' and v_claimed_count < 100;

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------
-- request_payout: solo habilitado exactamente en 10/30/50/70/100
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- admin_approve_payout: paga y RESETEA el progreso de ESE empleado
-- ---------------------------------------------------------------------
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
     set verified_count = 0, cycle_number = cycle_number + 1, updated_at = now()
   where promoter_id = v_payout.promoter_id;

  return v_payout;
end;
$$;

create or replace function public.admin_reject_payout(p_payout_id uuid, p_reason text)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payout_requests;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede rechazar pagos.';
  end if;

  update public.payout_requests
     set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
   where id = p_payout_id and status = 'pending'
   returning * into v_payout;

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada.';
  end if;

  return v_payout;
end;
$$;

-- ---------------------------------------------------------------------
-- ensure_promoter_setup: autorreparación — crea profile/promoter_progress
-- del usuario autenticado si por alguna razón no existen.
-- ---------------------------------------------------------------------
create or replace function public.ensure_promoter_setup()
returns public.promoter_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_progress public.promoter_progress;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    select email, coalesce(raw_user_meta_data ->> 'full_name', '')
      into v_email, v_full_name
      from auth.users where id = v_uid;

    insert into public.profiles (id, full_name, email)
    values (v_uid, v_full_name, v_email)
    on conflict (id) do nothing;
  end if;

  insert into public.promoter_progress (promoter_id) values (v_uid)
    on conflict (promoter_id) do nothing;

  select * into v_progress from public.promoter_progress where promoter_id = v_uid;
  return v_progress;
end;
$$;

-- ---------------------------------------------------------------------
-- handle_new_user: crea profile + promoter_progress al registrarse
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );

  insert into public.promoter_progress (promoter_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.bingo_tables enable row level security;
alter table public.table_access enable row level security;
alter table public.promoter_progress enable row level security;
alter table public.reviews_log enable row level security;
alter table public.payout_requests enable row level security;
alter table public.google_reviewers_registry enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- bingo_tables: cualquier empleado autenticado puede VER la lista de
-- tableros (nombre/estado, nada sensible) para poder postularse a los que
-- no tiene acceso todavía. El contenido sensible (quién reclamó qué
-- casilla) vive aparte en table_grid_view, esa sí restringida.
create policy "tables_select_authenticated" on public.bingo_tables
  for select using (auth.uid() is not null);

-- table_access: cada quien ve sus propios accesos; admin ve todos.
create policy "access_select_own_or_admin" on public.table_access
  for select using (promoter_id = auth.uid() or public.is_admin());

-- promoter_progress: cada quien ve el suyo; admin ve todos.
create policy "progress_select_own_or_admin" on public.promoter_progress
  for select using (promoter_id = auth.uid() or public.is_admin());

-- reviews_log: el detalle completo (nombre, captura) solo lo ve quien
-- reclamó la casilla, o el admin. La vista compartida del tablero (sin
-- datos sensibles del reviewer) va en table_grid_view más abajo.
create policy "reviews_select_own_or_admin" on public.reviews_log
  for select using (promoter_id = auth.uid() or public.is_admin());

-- payout_requests: cada quien ve las suyas; admin ve todas.
create policy "payouts_select_own_or_admin" on public.payout_requests
  for select using (promoter_id = auth.uid() or public.is_admin());

-- google_reviewers_registry: solo admin (auditoría global anti-fraude)
create policy "registry_select_admin_only" on public.google_reviewers_registry
  for select using (public.is_admin());

-- app_settings: cualquier empleado autenticado puede leerla (necesita ver
-- el QR/link del negocio para pedirle la reseña al cliente); solo el admin
-- puede escribirla (vía admin_update_app_settings, SECURITY DEFINER).
create policy "settings_select_authenticated" on public.app_settings
  for select using (auth.uid() is not null);

-- =====================================================================
-- VISTA: tablero compartido (lo que ve cualquier empleado con acceso) —
-- sin exponer el nombre de Google ni la captura de OTROS empleados,
-- solo qué casilla está tomada, su estado, y quién la reclamó.
-- =====================================================================
create or replace view public.table_grid_view as
select
  rl.table_id,
  rl.cell_number,
  rl.status,
  rl.promoter_id,
  p.full_name as promoter_name,
  rl.submitted_at,
  rl.verified_at
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

-- =====================================================================
-- VISTA: solicitudes de cobro con datos del empleado, para el panel
-- "Solicitudes de Cobro Pendientes"
-- =====================================================================
create or replace view public.admin_payout_requests_view as
select
  pr.id,
  pr.promoter_id,
  p.full_name,
  p.email,
  pr.payment_method,
  pr.payment_number,
  pr.milestone,
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

-- =====================================================================
-- STORAGE: bucket público para las capturas de pantalla de reseñas
-- =====================================================================
-- Público de solo-lectura por simplicidad (las URLs llevan un UUID
-- aleatorio, no son adivinables/enumerables). Cualquier usuario
-- autenticado puede subir; nadie puede sobrescribir ni borrar lo de otro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-screenshots', 'review-screenshots', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "review_screenshots_authenticated_upload" on storage.objects;
create policy "review_screenshots_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'review-screenshots');
