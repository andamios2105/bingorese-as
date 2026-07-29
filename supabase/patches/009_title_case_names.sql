-- =====================================================================
-- PARCHE 009: capitalización automática (primera letra de cada palabra en
-- mayúscula) para nombres de empleados, tableros, negocios, premios,
-- loterías y nombres de perfil de Google — usando initcap() de Postgres,
-- para que quede consistente sin importar por dónde entre el dato.
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) handle_new_user: nombre del empleado al registrarse
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
    initcap(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );

  insert into public.promoter_progress (promoter_id) values (new.id);

  return new;
end;
$$;

-- 2) ensure_promoter_setup: autorreparación con el mismo formato
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
    values (v_uid, initcap(v_full_name), v_email)
    on conflict (id) do nothing;
  end if;

  insert into public.promoter_progress (promoter_id) values (v_uid)
    on conflict (promoter_id) do nothing;

  select * into v_progress from public.promoter_progress where promoter_id = v_uid;
  return v_progress;
end;
$$;

-- 3) admin_create_table: nombre/negocio/premio/lotería (el link de Google
-- Maps NO se capitaliza, es una URL)
create or replace function public.admin_create_table(
  p_name text,
  p_business_name text default null,
  p_google_maps_url text default null,
  p_prize text default null,
  p_lottery_name text default null,
  p_draw_date date default null
)
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

  insert into public.bingo_tables (
    name, business_name, google_maps_url, prize, lottery_name, draw_date, created_by
  ) values (
    initcap(trim(p_name)),
    nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
    nullif(trim(coalesce(p_google_maps_url, '')), ''),
    nullif(initcap(trim(coalesce(p_prize, ''))), ''),
    nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
    p_draw_date,
    auth.uid()
  )
  returning * into v_table;

  return v_table;
end;
$$;

-- 4) admin_update_table_details: mismo criterio al editar
create or replace function public.admin_update_table_details(
  p_table_id uuid,
  p_name text,
  p_business_name text,
  p_google_maps_url text,
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
     set name = initcap(trim(p_name)),
         business_name = nullif(initcap(trim(coalesce(p_business_name, ''))), ''),
         google_maps_url = nullif(trim(coalesce(p_google_maps_url, '')), ''),
         prize = nullif(initcap(trim(coalesce(p_prize, ''))), ''),
         lottery_name = nullif(initcap(trim(coalesce(p_lottery_name, ''))), ''),
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

-- 5) submit_review: nombre del perfil de Google mostrado (el "handle"
-- normalizado usado para el candado anti-duplicados no cambia)
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
      p_table_id, p_cell_number, v_promoter_id, v_handle, v_display_name, p_screenshot_url, 'pending'
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
