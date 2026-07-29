import { createClient } from "@/lib/supabase/server";
import AuditSearch from "@/components/admin/AuditSearch";
import { formatCOP } from "@/lib/validation";

export default async function AdminAuditPage() {
  const supabase = createClient();

  const [{ data: paidHistory }, { data: rejectedReviews }] = await Promise.all([
    supabase
      .from("admin_payout_requests_view")
      .select("*")
      .eq("status", "approved")
      .order("resolved_at", { ascending: false })
      .limit(20),
    supabase
      .from("reviews_log")
      .select("id, google_profile_name_raw, review_url, rejection_reason, rejected_at, profiles:promoter_id(full_name)")
      .eq("status", "rejected")
      .order("rejected_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-5 py-4">
      <h2 className="text-lg font-bold">Auditoría anti-fraude</h2>

      <AuditSearch />

      <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Historial de pagos aprobados</h3>
        {!paidHistory || paidHistory.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay pagos aprobados.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {paidHistory.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                <span>
                  {p.full_name} · {p.reviews_count} reseñas × {formatCOP(p.rate_applied)}
                </span>
                <span className="font-semibold text-emerald-400">{formatCOP(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Reseñas rechazadas recientes</h3>
        {!rejectedReviews || rejectedReviews.length === 0 ? (
          <p className="text-sm text-slate-500">No hay reseñas rechazadas.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rejectedReviews.map((r: any) => (
              <li key={r.id} className="rounded-lg bg-slate-800 px-3 py-2">
                <p className="font-medium">{r.google_profile_name_raw}</p>
                <p className="text-xs text-slate-500">
                  {r.profiles?.full_name ?? "—"} · motivo: {r.rejection_reason ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
