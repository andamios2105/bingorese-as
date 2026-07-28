"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BingoTable, TableStatus } from "@/types/database";

const STATUS_LABEL: Record<TableStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  full: "Lleno",
  archived: "Archivado",
};

export default function TableManagementPanel({ table, claimedCount }: { table: BingoTable; claimedCount: number }) {
  const router = useRouter();
  const [name, setName] = useState(table.name);
  const [prize, setPrize] = useState(table.prize ?? "");
  const [lotteryName, setLotteryName] = useState(table.lottery_name ?? "");
  const [drawDate, setDrawDate] = useState(table.draw_date ?? "");
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prize, lotteryName, drawDate: drawDate || null }),
    });
    const body = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    router.refresh();
  }

  async function changeStatus(status: TableStatus) {
    setStatusBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/tables/${table.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    setStatusBusy(false);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/admin/tables/${table.id}`, { method: "DELETE" });
    const body = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setError(body.error);
      setConfirmingDelete(false);
      return;
    }

    router.push("/admin/tables");
    router.refresh();
  }

  const statusOptions: TableStatus[] = ["active", "paused", "archived"];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Estado del tablero</h3>
          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {STATUS_LABEL[table.status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions
            .filter((s) => s !== table.status)
            .map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={statusBusy}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
              >
                {s === "active" ? "Reanudar" : s === "paused" ? "Pausar" : "Archivar"}
              </button>
            ))}
        </div>
        {table.status === "paused" && (
          <p className="mt-2 text-xs text-slate-500">
            Pausado: nadie puede reclamar casillas nuevas hasta que lo reanudes.
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3 rounded-2xl bg-slate-900 p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-300">Editar tablero</h3>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Nombre</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Premio</label>
          <input
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="Ej: Nevera de 300L"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Lotería</label>
            <input
              value={lotteryName}
              onChange={(e) => setLotteryName(e.target.value)}
              placeholder="Ej: Lotería de Boyacá"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Fecha de juego</label>
            <input
              type="date"
              value={drawDate}
              onChange={(e) => setDrawDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div className="rounded-2xl border border-red-500/20 bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-red-400">Zona de peligro</h3>
        {claimedCount > 0 ? (
          <p className="text-xs text-slate-500">
            Este tablero ya tiene {claimedCount} casilla(s) reclamada(s) — no se puede borrar (perderías el
            historial). Archívalo en vez de borrarlo.
          </p>
        ) : confirmingDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">¿Seguro que quieres borrar este tablero? No se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {deleting ? "Borrando..." : "Sí, borrar"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-sm font-semibold text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-red-400"
          >
            Borrar tablero
          </button>
        )}
      </div>
    </div>
  );
}
