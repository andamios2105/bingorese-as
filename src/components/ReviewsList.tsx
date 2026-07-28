"use client";

import { ReviewLog } from "@/types/database";

const STATUS_LABEL: Record<ReviewLog["status"], string> = {
  pending: "En verificación",
  verified: "Verificada",
  rejected: "Rechazada",
};

const STATUS_STYLE: Record<ReviewLog["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400",
  verified: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default function ReviewsList({ reviews }: { reviews: ReviewLog[] }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-slate-500">Aún no has registrado ninguna reseña en este ciclo.</p>;
  }

  return (
    <ul className="space-y-2">
      {reviews.map((review) => (
        <li key={review.id} className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{review.google_profile_name_raw}</p>
            <p className="text-xs text-slate-500">
              {new Date(review.submitted_at).toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {review.status === "rejected" && review.rejection_reason && (
              <p className="mt-0.5 text-xs text-red-400">Motivo: {review.rejection_reason}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[review.status]}`}>
            {STATUS_LABEL[review.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
