"use client";

import { useState } from "react";
import { TableGridCell } from "@/types/database";
import ReviewModal from "./ReviewModal";

const MILESTONE_NUMBERS = new Set([10, 30, 50, 70, 100]);

export default function ClaimableBingoGrid({
  tableId,
  cells,
  interactive,
}: {
  tableId: string;
  cells: TableGridCell[];
  interactive: boolean;
}) {
  const [selectedEmptyCell, setSelectedEmptyCell] = useState<number | null>(null);
  const byNumber = new Map(cells.map((c) => [c.cell_number, c]));

  return (
    <>
      <div className="grid grid-cols-10 gap-1 rounded-2xl bg-slate-900 p-3 shadow-xl sm:gap-1.5 sm:p-4">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((number) => {
          const cell = byNumber.get(number);
          const isMilestone = MILESTONE_NUMBERS.has(number);
          const state = cell?.status ?? "empty";

          const base =
            state === "verified"
              ? "bg-emerald-500 text-slate-950 border-emerald-400"
              : state === "pending"
                ? "bg-amber-500 text-slate-950 border-amber-400 animate-pulse"
                : "bg-slate-800 text-slate-500 border-slate-700";

          const clickable = !cell && interactive;

          return (
            <button
              key={number}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (!cell && interactive) setSelectedEmptyCell(number);
              }}
              title={
                cell
                  ? `Casilla ${number}: reclamada por ${cell.promoter_name} (${
                      cell.status === "verified" ? "verificada" : "en verificación"
                    })`
                  : clickable
                    ? `Casilla ${number}: disponible — clic para reclamarla`
                    : `Casilla ${number}: vacía`
              }
              className={`relative flex aspect-square items-center justify-center rounded-md border text-[10px] font-bold transition-all duration-300 sm:text-xs ${base} ${
                clickable ? "cursor-pointer hover:brightness-110 active:scale-95" : "cursor-default"
              } ${state === "verified" ? "animate-pop" : ""}`}
            >
              {number}
              {isMilestone && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-yellow-300 ring-1 ring-slate-950" />
              )}
            </button>
          );
        })}
      </div>

      {selectedEmptyCell !== null && (
        <ReviewModal tableId={tableId} cellNumber={selectedEmptyCell} onClose={() => setSelectedEmptyCell(null)} />
      )}
    </>
  );
}
