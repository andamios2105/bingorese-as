-- =====================================================================
-- PARCHE 006: los empleados también pueden leer app_settings (necesitan
-- ver el link/QR fijo de Google Maps para pedirle la reseña al cliente).
-- Solo el admin puede seguir escribiéndola (admin_update_app_settings).
-- =====================================================================
-- Incremental, no borra nada existente.

drop policy if exists "settings_select_admin_only" on public.app_settings;

create policy "settings_select_authenticated" on public.app_settings
  for select using (auth.uid() is not null);
