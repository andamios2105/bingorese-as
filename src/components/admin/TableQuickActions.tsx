"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TableStatus } from "@/types/database";

const ACTION_LABEL: Record<Exclude<TableStatus, "full">, string> = {
  active: "Reanudar",
  paused: "Pausar",
  archived: "Archivar",
};

export default function TableQuickActions({ tableId, status }: { tableId: string; status: TableStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: TableStatus[] = (["active", "paused", "archived"] as const).filter((s) => s !== status);

  async function changeStatus(newStatus: TableStatus) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/tables/${tableId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo cambiar el estado.");
      return;
    }

    router.refresh();
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {options.map((s) => (
        <button
          key={s}
          onClick={() => changeStatus(s)}
          disabled={busy}
          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 disabled:opacity-50"
        >
          {ACTION_LABEL[s as Exclude<TableStatus, "full">]}
        </button>
      ))}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
