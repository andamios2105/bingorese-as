"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageLightbox from "@/components/ImageLightbox";

export interface PendingReviewItem {
  id: string;
  google_profile_name_raw: string;
  screenshot_url: string;
  submitted_at: string;
  cell_number: number;
  table_name: string;
  promoter_name: string;
  promoter_email: string;
}

export default function ReviewVerificationList({ reviews }: { reviews: PendingReviewItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openImage, setOpenImage] = useState<{ src: string; alt: string } | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/reviews/${id}/approve`, { method: "POST" });
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
    const res = await fetch(`/api/admin/reviews/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setRejectingId(null);
    setReason("");
    router.refresh();
  }

  if (reviews.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No hay reseñas pendientes de verificación. 🎉</p>;
  }

  return (
    <>
    <ul className="space-y-3 py-4">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.google_profile_name_raw}</p>
              <p className="truncate text-xs text-slate-500">
                {r.promoter_name} · {r.promoter_email}
              </p>
              <p className="text-xs text-slate-500">
                {r.table_name} · casilla #{r.cell_number}
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {new Date(r.submitted_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setOpenImage({ src: r.screenshot_url, alt: `Captura de la reseña de ${r.google_profile_name_raw}` })
            }
            className="mb-3 block w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.screenshot_url}
              alt={`Captura de la reseña de ${r.google_profile_name_raw}`}
              className="max-h-64 w-full rounded-lg border border-slate-800 object-contain"
            />
          </button>

          {error && busyId === null && <p className="mb-2 text-sm text-red-400">{error}</p>}

          {rejectingId === r.id ? (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo del rechazo"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => reject(r.id)}
                  disabled={busyId === r.id}
                  className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  Confirmar rechazo
                </button>
                <button
                  onClick={() => setRejectingId(null)}
                  className="flex-1 rounded-lg bg-slate-800 py-2 text-sm font-semibold text-slate-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => approve(r.id)}
                disabled={busyId === r.id}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {busyId === r.id ? "..." : "Aprobar"}
              </button>
              <button
                onClick={() => setRejectingId(r.id)}
                disabled={busyId === r.id}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
    {openImage && <ImageLightbox src={openImage.src} alt={openImage.alt} onClose={() => setOpenImage(null)} />}
    </>
  );
}
