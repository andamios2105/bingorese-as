-- =====================================================================
-- PARCHE 005: agrega fecha de reclamo/verificación a la vista compartida
-- del tablero, para poder mostrar el historial al hacer clic en una casilla.
-- =====================================================================
-- Incremental, no borra nada existente — solo redefine una vista.

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
