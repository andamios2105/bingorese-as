-- =====================================================================
-- PARCHE 017: notificaciones push (Web Push). Guarda los dispositivos
-- suscritos de cada empleado para poder avisarle cosas como "bienvenido
-- al tablero", "reseña validada" o "reseña rechazada" directo en su
-- celular, sin depender de que tenga la app abierta.
-- =====================================================================
-- Incremental, no borra nada existente.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_promoter_idx on public.push_subscriptions (promoter_id);

comment on table public.push_subscriptions is
  'Un dispositivo/navegador suscrito a notificaciones push Web Push. Un empleado puede tener varias (varios dispositivos).';

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own_or_admin" on public.push_subscriptions;
create policy "push_select_own_or_admin" on public.push_subscriptions
  for select using (promoter_id = auth.uid() or public.is_admin());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert with check (promoter_id = auth.uid());

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update using (promoter_id = auth.uid()) with check (promoter_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete using (promoter_id = auth.uid());
