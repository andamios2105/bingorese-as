"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCOP } from "@/lib/validation";
import { AdminPayoutRequestView } from "@/types/database";

export default function PayoutRequestList({ payouts }: { payouts: AdminPayoutRequestView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/payouts/${id}/approve`, { method: "POST" });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    router.refresh();
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/payouts/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Rechazado por administrador" }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    router.refresh();
  }

  if (payouts.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No hay solicitudes de cobro pendientes.</p>;
  }

  return (
    <ul className="space-y-3 py-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {payouts.map((p) => (
        <li key={p.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="font-semibold">{p.full_name}</p>
              <p className="text-xs text-slate-500">{p.email}</p>
            </div>
            <p className="text-xl font-extrabold text-emerald-400">{formatCOP(p.amount)}</p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-800 px-3 py-2">
              <p className="text-slate-500">Reseñas × tarifa</p>
              <p className="font-semibold">
                {p.reviews_count} × {formatCOP(p.rate_applied)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 px-3 py-2">
              <p className="text-slate-500">Confirmación (deben coincidir)</p>
              <p className="font-semibold">{p.verified_reviews_in_cycle} reseñas</p>
            </div>
            <div className="col-span-2 rounded-lg bg-slate-800 px-3 py-2 capitalize">
              <p className="text-slate-500">Pago a</p>
              <p className="font-semibold">
                {p.payment_method} · {p.payment_number}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => approve(p.id)}
              disabled={busyId === p.id}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busyId === p.id ? "..." : "Aprobar pago y resetear cartón"}
            </button>
            <button
              onClick={() => reject(p.id)}
              disabled={busyId === p.id}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
