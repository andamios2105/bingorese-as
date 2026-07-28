"use client";

import { MILESTONES } from "@/types/database";

export default function ProgressBar({ verifiedCount }: { verifiedCount: number }) {
  return (
    <div className="w-full">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${verifiedCount}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
        {MILESTONES.map((m) => (
          <span key={m} className={verifiedCount >= m ? "font-semibold text-emerald-400" : ""}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
