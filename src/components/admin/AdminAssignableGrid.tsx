"use client";

import { useState } from "react";
import { TableGridCell } from "@/types/database";
import AdminAssignModal from "./AdminAssignModal";
import { AccessMember } from "./TableAccessManager";
import CellDetailModal from "@/components/CellDetailModal";

const MILESTONE_NUMBERS = new Set([10, 30, 50, 70, 100]);

export default function AdminAssignableGrid({
  tableId,
  cells,
  members,
  currentAdmin,
}: {
  tableId: string;
  cells: TableGridCell[];
  members: AccessMember[];
  currentAdmin: AccessMember | null;
}) {
  const [selectedEmptyCell, setSelectedEmptyCell] = useState<number | null>(null);
  const [detailCell, setDetailCell] = useState<TableGridCell | null>(null);
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

          return (
            <button
              key={number}
              type="button"
              onClick={() => {
                if (cell) setDetailCell(cell);
                else setSelectedEmptyCell(number);
              }}
              title={
                cell
                  ? `Casilla ${number}: reclamada por ${cell.promoter_name} (${
                      cell.status === "verified" ? "verificada" : "en verificación"
                    }) — clic para ver detalle`
                  : `Casilla ${number}: disponible — clic para asignarla a un empleado`
              }
              className={`relative flex aspect-square items-center justify-center rounded-md border text-[10px] font-bold transition-all duration-300 sm:text-xs ${base} cursor-pointer hover:brightness-110 active:scale-95`}
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
        <AdminAssignModal
          tableId={tableId}
          cellNumber={selectedEmptyCell}
          members={members}
          currentAdmin={currentAdmin}
          onClose={() => setSelectedEmptyCell(null)}
        />
      )}

      {detailCell && <CellDetailModal cell={detailCell} onClose={() => setDetailCell(null)} />}
    </>
  );
}
