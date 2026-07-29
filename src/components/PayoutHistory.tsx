"use client";

import { useState } from "react";
import { PayoutRequest } from "@/types/database";
import { formatCOP, formatDateTime } from "@/lib/validation";

export default function PayoutHistory({ payouts }: { payouts: PayoutRequest[] }) {
  const [open, setOpen] = useState(false);
  const resolved = payouts.filter((p) => p.status !== "pending");
  if (resolved.length === 0) return null;

  const totalPaid = resolved.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-900 p-4 text-left shadow-xl"
      >
        <span className="text-sm font-semibold text-slate-300">Historial de pagos ›</span>
        <span className="text-sm">
          Retirado: <span className="font-semibold text-emerald-400">{formatCOP(totalPaid)}</span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Historial de pagos</h2>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400">
                &times;
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-400">
              Total retirado: <span className="font-semibold text-emerald-400">{formatCOP(totalPaid)}</span>
            </p>

            <ul className="space-y-2">
              {resolved.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        p.status === "approved" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatCOP(p.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.reviews_count ?? 0} reseñas · {formatDateTime(p.resolved_at ?? p.requested_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      p.status === "approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {p.status === "approved" ? "Pagado" : "Rechazado"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
