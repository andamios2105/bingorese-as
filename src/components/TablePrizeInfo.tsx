import { BingoTable } from "@/types/database";
import { daysUntil, formatDrawDate } from "@/lib/validation";

export default function TablePrizeInfo({ table }: { table: BingoTable }) {
  if (!table.prize && !table.lottery_name && !table.draw_date) return null;

  const days = daysUntil(table.draw_date);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 p-4 text-white shadow-xl">
      {table.prize && (
        <p className="text-lg font-extrabold leading-tight">
          🎁 {table.prize}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-violet-100">
        {table.lottery_name && <span>Juega con: {table.lottery_name}</span>}
        {table.draw_date && <span>Fecha: {formatDrawDate(table.draw_date)}</span>}
      </div>
      {days !== null && (
        <p className="mt-2 text-sm font-semibold">
          {days > 1
            ? `Faltan ${days} días`
            : days === 1
              ? "¡Juega mañana!"
              : days === 0
                ? "¡Juega hoy!"
                : "Ya jugó"}
        </p>
      )}
    </div>
  );
}
