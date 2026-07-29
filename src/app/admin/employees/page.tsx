import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EmployeeActions from "@/components/admin/EmployeeActions";
import EmployeeEditButton from "@/components/admin/EmployeeEditButton";
import { currentPayoutAmount, formatCOP, formatDateTime } from "@/lib/validation";

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
    .select(
      "id, full_name, email, phone, payment_method, payment_number, is_suspended, suspended_until, promoter_progress(verified_count)"
    )
    .eq("role", "promoter")
    .order("full_name");

  const [{ data: accessRows }, { data: reviewRows }, { data: payoutRows }, { data: pendingPayoutRows }] =
    await Promise.all([
      supabase.from("table_access").select("promoter_id"),
      supabase.from("reviews_log").select("promoter_id"),
      supabase.from("payout_requests").select("promoter_id"),
      supabase.from("payout_requests").select("promoter_id, amount").eq("status", "pending"),
    ]);

  const tableCountByPromoter: Record<string, number> = {};
  (accessRows ?? []).forEach((a) => {
    tableCountByPromoter[a.promoter_id] = (tableCountByPromoter[a.promoter_id] ?? 0) + 1;
  });

  const historyByPromoter = new Set<string>();
  (reviewRows ?? []).forEach((r) => historyByPromoter.add(r.promoter_id));
  (payoutRows ?? []).forEach((p) => historyByPromoter.add(p.promoter_id));

  const pendingPayoutByPromoter = new Map<string, number>();
  (pendingPayoutRows ?? []).forEach((p) => pendingPayoutByPromoter.set(p.promoter_id, p.amount));

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
          {employees.map((e: any) => {
            const isFined = !e.is_suspended && !!e.suspended_until && new Date(e.suspended_until) > new Date();
            return (
              <li key={e.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.full_name || "(sin nombre)"}</p>
                    <p className="truncate text-xs text-slate-500">{e.email}</p>
                    {e.phone && <p className="text-xs text-slate-500">{e.phone}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                    {formatCOP(currentPayoutAmount(extractVerifiedCount(e.promoter_progress)))}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{extractVerifiedCount(e.promoter_progress)} reseñas acumuladas</p>

                {(e.is_suspended || isFined) && (
                  <p className="mt-1.5 text-xs font-semibold text-red-400">
                    {e.is_suspended
                      ? "Suspendido indefinidamente"
                      : `Multado hasta ${formatDateTime(e.suspended_until)}`}
                  </p>
                )}

                {pendingPayoutByPromoter.has(e.id) && (
                  <Link
                    href="/admin/payouts"
                    className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400"
                  >
                    Cobro pendiente: {formatCOP(pendingPayoutByPromoter.get(e.id)!)}
                  </Link>
                )}

                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{tableCountByPromoter[e.id] ?? 0} tablero(s) con acceso</span>
                  <span>
                    {e.payment_method
                      ? `${e.payment_method} · ${e.payment_number}`
                      : "Sin método de pago configurado"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <EmployeeEditButton
                    promoterId={e.id}
                    fullName={e.full_name ?? ""}
                    phone={e.phone}
                    paymentMethod={e.payment_method}
                    paymentNumber={e.payment_number}
                  />
                </div>

                <EmployeeActions
                  promoterId={e.id}
                  isSuspended={e.is_suspended}
                  suspendedUntil={e.suspended_until}
                  hasHistory={historyByPromoter.has(e.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
