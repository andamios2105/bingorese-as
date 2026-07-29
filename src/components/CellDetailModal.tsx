"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TableGridCell } from "@/types/database";
import { formatDateTime } from "@/lib/validation";
import ImageLightbox from "@/components/ImageLightbox";

interface ExtraDetail {
  id: string;
  google_profile_name_raw: string;
  reviewer_phone: string | null;
  screenshot_url: string | null;
  assigned_by_admin: boolean;
}

export default function CellDetailModal({ cell, onClose }: { cell: TableGridCell; onClose: () => void }) {
  const router = useRouter();
  const [extra, setExtra] = useState<ExtraDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // Best-effort: RLS solo deja ver el detalle completo (nombre de Google,
    // captura) si la casilla es propia o si el que mira es admin. Si no
    // aplica, simplemente no llega nada y el modal se queda con lo básico.
    supabase
      .from("reviews_log")
      .select("id, google_profile_name_raw, reviewer_phone, screenshot_url, assigned_by_admin")
      .eq("table_id", cell.table_id)
      .eq("cell_number", cell.cell_number)
      .in("status", ["pending", "verified"])
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setExtra((data as ExtraDetail) ?? null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cell.table_id, cell.cell_number]);

  async function handleDelete() {
    if (!extra) return;
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/admin/reviews/${extra.id}/delete`, { method: "POST" });
    const body = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setDeleteError(body.error);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Casilla #{cell.cell_number}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            &times;
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">Reclamada por</p>
            <p className="font-semibold">{cell.promoter_name}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Estado</p>
            <p
              className={`font-semibold ${cell.status === "verified" ? "text-emerald-400" : "text-amber-400"}`}
            >
              {cell.status === "verified" ? "Verificada" : "En verificación"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Reclamada el</p>
            <p className="font-medium">{formatDateTime(cell.submitted_at)}</p>
          </div>

          {cell.verified_at && (
            <div>
              <p className="text-xs text-slate-500">Verificada el</p>
              <p className="font-medium">{formatDateTime(cell.verified_at)}</p>
            </div>
          )}

          {loading ? (
            <p className="text-xs text-slate-500">Cargando detalle...</p>
          ) : extra ? (
            <>
              <div>
                <p className="text-xs text-slate-500">
                  {extra.assigned_by_admin ? "Nota del administrador" : "Nombre del perfil de Google"}
                </p>
                <p className="font-medium">{extra.google_profile_name_raw}</p>
              </div>

              {extra.reviewer_phone && (
                <div>
                  <p className="text-xs text-slate-500">Celular (por si gana el premio)</p>
                  <p className="font-medium">{extra.reviewer_phone}</p>
                </div>
              )}

              {extra.screenshot_url && (
                <div>
                  <p className="mb-1 text-xs text-slate-500">Captura de la reseña</p>
                  <button type="button" onClick={() => setShowImage(true)} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={extra.screenshot_url}
                      alt="Captura de la reseña"
                      className="max-h-64 w-full rounded-lg border border-slate-800 object-contain"
                    />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Los detalles de la reseña (nombre/captura) solo los puede ver quien la reclamó o un administrador.
            </p>
          )}

          {extra && (
            <div className="border-t border-slate-800 pt-3">
              {deleteError && <p className="mb-2 text-xs text-red-400">{deleteError}</p>}
              {confirmingDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    ¿Seguro que quieres borrar esta casilla? La casilla queda libre para que cualquier empleado la
                    reclame de nuevo
                    {cell.status === "verified" ? " y se le resta 1 reseña del total al empleado" : ""}. No se puede
                    deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {deleting ? "Borrando..." : "Sí, borrar casilla"}
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
                  Borrar casilla
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {showImage && extra?.screenshot_url && (
      <ImageLightbox src={extra.screenshot_url} alt="Captura de la reseña" onClose={() => setShowImage(false)} />
    )}
    </>
  );
}
