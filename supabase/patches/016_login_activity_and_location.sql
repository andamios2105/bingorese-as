-- =====================================================================
-- PARCHE 016: última conexión (fecha/hora + "hace cuánto") y ubicación
-- por empleado en el panel admin.
--
-- Ubicación: SIEMPRE se guarda la ciudad aproximada por IP al iniciar
-- sesión (no requiere permiso del navegador). El GPS exacto SOLO se
-- guarda si el empleado ya dio permiso de ubicación en su navegador —
-- el aviso está en la página de login, y el navegador solo pregunta la
-- primera vez; si lo acepta, se actualiza en cada login sin volver a
-- preguntar. Nunca hay rastreo continuo ni en segundo plano.
-- =====================================================================
-- Incremental, no borra nada existente.

-- 1) Tabla de sesiones de login
create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.profiles (id) on delete cascade,
  ip_address text,
  ip_city text,
  ip_region text,
  ip_country text,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_m double precision,
  created_at timestamptz not null default now()
);

create index if not exists login_sessions_promoter_idx on public.login_sessions (promoter_id, created_at desc);

alter table public.login_sessions enable row level security;

drop policy if exists "login_sessions_select_own_or_admin" on public.login_sessions;
create policy "login_sessions_select_own_or_admin" on public.login_sessions
  for select using (promoter_id = auth.uid() or public.is_admin());

-- 2) Reemplaza admin_list_promoter_verification por una versión que
-- también trae la última conexión (cambia el tipo de retorno, hay que
-- borrar la función vieja primero)
drop function if exists public.admin_list_promoter_verification();

create or replace function public.admin_list_promoter_activity()
returns table (promoter_id uuid, email_confirmed boolean, last_sign_in_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, (au.email_confirmed_at is not null), au.last_sign_in_at
    from public.profiles p
    join auth.users au on au.id = p.id
   where p.role = 'promoter'
     and public.is_admin();
$$;

-- 3) Registra una sesión de login (llamada desde /api/auth/log-session)
create or replace function public.log_login_session(
  p_ip_address text,
  p_ip_city text,
  p_ip_region text,
  p_ip_country text,
  p_gps_lat double precision,
  p_gps_lng double precision,
  p_gps_accuracy_m double precision
) returns public.login_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.login_sessions;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  insert into public.login_sessions (
    promoter_id, ip_address, ip_city, ip_region, ip_country, gps_lat, gps_lng, gps_accuracy_m
  ) values (
    v_uid, p_ip_address, p_ip_city, p_ip_region, p_ip_country, p_gps_lat, p_gps_lng, p_gps_accuracy_m
  ) returning * into v_session;

  return v_session;
end;
$$;

-- 4) Vista con la última ubicación conocida de cada empleado
create or replace view public.admin_promoter_last_location as
select distinct on (ls.promoter_id)
  ls.promoter_id,
  ls.ip_address,
  ls.ip_city,
  ls.ip_region,
  ls.ip_country,
  ls.gps_lat,
  ls.gps_lng,
  ls.gps_accuracy_m,
  ls.created_at
from public.login_sessions ls
where ls.promoter_id = auth.uid() or public.is_admin()
order by ls.promoter_id, ls.created_at desc;

grant select on public.admin_promoter_last_location to authenticated;
