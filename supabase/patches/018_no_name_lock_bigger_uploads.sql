-- =====================================================================
-- PARCHE 018: el nombre de perfil de Google deja de bloquear reseñas
-- (mucha gente comparte nombre; el anti-fraude real es la verificación
-- manual del admin contra Google Maps), y se sube el límite de tamaño
-- del bucket de capturas de pantalla (fotos de celular pueden pesar más
-- de 5MB).
-- =====================================================================
-- Incremental, no borra historial existente.

-- 1) Ya no exige que google_handle sea único: quita el candado global.
alter table public.google_reviewers_registry
  drop constraint if exists google_reviewers_registry_google_handle_key;

create index if not exists google_reviewers_registry_handle_idx
  on public.google_reviewers_registry (google_handle);

-- 2) submit_review: quita el bloqueo por nombre repetido (Regla 2.a
-- derogada), solo guarda el nombre como historial/auditoría.
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

  -- El nombre de perfil NO bloquea el envío (mucha gente comparte nombre):
  -- solo se normaliza y se guarda para el historial/auditoría del admin.
  v_handle := public.normalize_google_handle(p_google_profile_name);
  v_display_name := initcap(trim(p_google_profile_name));
  if v_handle = '' then
    raise exception 'Nombre de perfil de Google inválido.';
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

-- 3) Sube el límite de tamaño del bucket de capturas (5MB -> 15MB).
update storage.buckets set file_size_limit = 15728640 where id = 'review-screenshots';
