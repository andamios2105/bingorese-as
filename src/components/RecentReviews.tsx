"use client";

import { useState } from "react";
import { ReviewLog } from "@/types/database";
import ReviewsList from "./ReviewsList";

export default function RecentReviews({ reviews }: { reviews: ReviewLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-900 p-4 text-left shadow-xl"
      >
        <span className="text-sm font-semibold text-slate-300">Tus reseñas recientes ›</span>
        <span className="text-sm text-slate-500">{reviews.length}</span>
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
              <h2 className="text-lg font-bold">Tus reseñas recientes</h2>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400">
                &times;
              </button>
            </div>

            <ReviewsList reviews={reviews} />
          </div>
        </div>
      )}
    </>
  );
}
