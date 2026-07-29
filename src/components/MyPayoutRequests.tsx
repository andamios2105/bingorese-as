import { PayoutRequest } from "@/types/database";
import { formatCOP, formatDateTime } from "@/lib/validation";

const STATUS_LABEL: Record<PayoutRequest["status"], string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_STYLE: Record<PayoutRequest["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default function MyPayoutRequests({ payouts }: { payouts: PayoutRequest[] }) {
  const pending = payouts.filter((p) => p.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
      <h3 className="mb-2 text-sm font-semibold text-slate-300">Solicitudes de pago pendientes</h3>
      <ul className="space-y-2">
        {pending.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-emerald-400">{formatCOP(p.amount)}</p>
              <p className="text-xs text-slate-500">
                {p.reviews_count} reseñas · enviada el {formatDateTime(p.requested_at)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
              {STATUS_LABEL[p.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Espera a que el administrador la apruebe.</p>
    </div>
  );
}
