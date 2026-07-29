"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeActions({
  promoterId,
  isSuspended,
  suspendedUntil,
  hasHistory,
}: {
  promoterId: string;
  isSuspended: boolean;
  suspendedUntil: string | null;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fining, setFining] = useState(false);
  const [days, setDays] = useState("3");
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTemporarilyFined = !isSuspended && !!suspendedUntil && new Date(suspendedUntil) > new Date();
  const isBlocked = isSuspended || isTemporarilyFined;

  async function call(path: string, options?: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, options);
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Ocurrió un error.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleSuspend() {
    await call(`/api/admin/employees/${promoterId}/suspend`, { method: "POST" });
  }

  async function handleReactivate() {
    await call(`/api/admin/employees/${promoterId}/reactivate`, { method: "POST" });
  }

  async function handleFine(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/admin/employees/${promoterId}/fine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: Number(days), reason }),
    });
    if (ok) {
      setFining(false);
      setReason("");
    }
  }

  async function handleDelete() {
    const ok = await call(`/api/admin/employees/${promoterId}`, { method: "DELETE" });
    if (ok) setConfirmingDelete(false);
  }

  return (
    <div className="mt-2 space-y-2">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {fining ? (
        <form onSubmit={handleFine} className="space-y-2 rounded-lg bg-slate-800 p-2.5">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs outline-none"
            />
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la multa"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              Confirmar multa
            </button>
            <button
              type="button"
              onClick={() => setFining(false)}
              className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : confirmingDelete ? (
        <div className="space-y-2 rounded-lg bg-slate-800 p-2.5">
          <p className="text-xs text-slate-300">¿Borrar este empleado? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 rounded-lg bg-red-500 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              Sí, borrar
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {isBlocked ? (
            <button
              onClick={handleReactivate}
              disabled={busy}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              Reactivar
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={busy}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
            >
              Suspender
            </button>
          )}
          <button
            onClick={() => setFining(true)}
            disabled={busy}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-amber-400 disabled:opacity-50"
          >
            Multar
          </button>
          <button
            onClick={() => (hasHistory ? null : setConfirmingDelete(true))}
            disabled={busy || hasHistory}
            title={hasHistory ? "Tiene reseñas o pagos registrados — suspéndelo en vez de borrarlo." : undefined}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Borrar
          </button>
        </div>
      )}
    </div>
  );
}
