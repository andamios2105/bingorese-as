import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la service_role key: bypassa RLS por completo y puede
 * administrar cuentas de Auth (ej. cambiar contraseñas de otros usuarios).
 *
 * SOLO se usa en Route Handlers que ya verificaron que quien llama es
 * admin (vía el cliente de sesión normal) — nunca importar este archivo
 * desde un componente cliente ni exponer SUPABASE_SERVICE_ROLE_KEY con
 * el prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
