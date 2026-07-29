"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/validation";

interface HistoryRow {
  id: string;
  cell_number: number;
  google_profile_name_raw: string;
  status: "pending" | "verified" | "rejected";
  submitted_at: string;
  rejection_reason: string | null;
  assigned_by_admin: boolean;
  table_name: string | null;
  promoter_name: string | null;
}

const STATUS_LABEL: Record<HistoryRow["status"], string> = {
  pending: "En verificación",
  verified: "Verificada",
  rejected: "Rechazada",
};

const STATUS_COLOR: Record<HistoryRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400",
  verified: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default function ReviewHistoryButton({
  promoterId,
  tableId,
  label = "Ver historial de reseñas",
}: {
  promoterId?: string;
  tableId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (rows) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    let query = supabase
      .from("reviews_log")
      .select(
        "id, cell_number, google_profile_name_raw, status, submitted_at, rejection_reason, assigned_by_admin, bingo_tables(name), profiles:promoter_id(full_name)"
      )
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (promoterId) query = query.eq("promoter_id", promoterId);
    if (tableId) query = query.eq("table_id", tableId);

    const { data, error: queryError } = await query;
    setLoading(false);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setRows(
      (data ?? []).map((r: any) => ({
        id: r.id,
        cell_number: r.cell_number,
        google_profile_name_raw: r.google_profile_name_raw,
        status: r.status,
        submitted_at: r.submitted_at,
        rejection_reason: r.rejection_reason,
        assigned_by_admin: r.assigned_by_admin,
        table_name: r.bingo_tables?.name ?? null,
        promoter_name: r.profiles?.full_name ?? null,
      }))
    );
  }

  return (
    <>
      <button onClick={handleOpen} className="text-xs text-sky-400 underline underline-offset-2">
        {label} ›
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Historial de reseñas</h2>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400">
                &times;
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Cargando...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-400">{error}</p>
            ) : !rows || rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Todavía no hay reseñas registradas.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li key={r.id} className="rounded-xl bg-slate-800 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">
                          #{rows.length - i} · Casilla {r.cell_number}
                        </p>
                        <p className="truncate text-sm font-medium">
                          {r.assigned_by_admin ? `(Asignada) ${r.google_profile_name_raw}` : r.google_profile_name_raw}
                        </p>
                        {tableId ? (
                          r.promoter_name && <p className="truncate text-xs text-slate-500">{r.promoter_name}</p>
                        ) : (
                          r.table_name && <p className="truncate text-xs text-slate-500">{r.table_name}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(r.submitted_at)}</p>
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="mt-1 text-xs text-red-400">Motivo: {r.rejection_reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
