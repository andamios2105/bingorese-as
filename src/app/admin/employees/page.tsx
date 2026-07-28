import { createClient } from "@/lib/supabase/server";

function extractVerifiedCount(progress: unknown): number {
  if (Array.isArray(progress)) {
    return (progress[0] as { verified_count?: number } | undefined)?.verified_count ?? 0;
  }
  return (progress as { verified_count?: number } | null | undefined)?.verified_count ?? 0;
}

export default async function AdminEmployeesPage() {
  const supabase = createClient();

  const { data: employees, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, payment_method, payment_number, promoter_progress(verified_count)")
    .eq("role", "promoter")
    .order("full_name");

  const { data: accessRows } = await supabase.from("table_access").select("promoter_id");
  const tableCountByPromoter: Record<string, number> = {};
  (accessRows ?? []).forEach((a) => {
    tableCountByPromoter[a.promoter_id] = (tableCountByPromoter[a.promoter_id] ?? 0) + 1;
  });

  if (error) {
    return <p className="py-8 text-center text-sm text-red-400">Error cargando empleados: {error.message}</p>;
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <h2 className="text-lg font-bold">Empleados registrados</h2>
        <p className="text-sm text-slate-500">
          Copia el correo de un empleado para darle acceso a un tablero desde <strong>Tableros</strong>.
        </p>
      </div>

      {!employees || employees.length === 0 ? (
        <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-500">
          Todavía no se ha registrado ningún empleado. Pídeles que creen su cuenta en /register.
        </p>
      ) : (
        <ul className="space-y-3">
          {employees.map((e: any) => (
            <li key={e.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.full_name || "(sin nombre)"}</p>
                  <p className="truncate text-xs text-slate-500">{e.email}</p>
                  {e.phone && <p className="text-xs text-slate-500">{e.phone}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  {extractVerifiedCount(e.promoter_progress)} reseñas
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{tableCountByPromoter[e.id] ?? 0} tablero(s) con acceso</span>
                <span>
                  {e.payment_method
                    ? `${e.payment_method} · ${e.payment_number}`
                    : "Sin método de pago configurado"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
