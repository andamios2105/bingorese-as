"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccessMember } from "./TableAccessManager";

export default function AdminAssignModal({
  tableId,
  cellNumber,
  members,
  currentAdmin,
  onClose,
}: {
  tableId: string;
  cellNumber: number;
  members: AccessMember[];
  currentAdmin: AccessMember | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const options: AccessMember[] = currentAdmin
    ? [currentAdmin, ...members.filter((m) => m.promoter_id !== currentAdmin.promoter_id)]
    : members;

  const [promoterId, setPromoterId] = useState(currentAdmin?.promoter_id ?? members[0]?.promoter_id ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!promoterId) {
      setError("Elige a qué empleado se la asignas.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/tables/${tableId}/assign-cell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cellNumber, promoterId, note }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo asignar la casilla.");
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Asignar casilla #{cellNumber}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            &times;
          </button>
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-slate-400">
            Ningún empleado tiene acceso a este tablero todavía — dale acceso a alguien primero.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Empleado</label>
              <select
                value={promoterId}
                onChange={(e) => setPromoterId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              >
                {options.map((m) => (
                  <option key={m.promoter_id} value={m.promoter_id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Nota (opcional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: regalo por cliente frecuente"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
            </div>

            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

            <p className="text-xs text-slate-500">
              Esta casilla queda <span className="font-semibold text-emerald-400">verificada de inmediato</span>,
              sin pasar por reseña ni captura de pantalla.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? "Asignando..." : "Asignar casilla"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
