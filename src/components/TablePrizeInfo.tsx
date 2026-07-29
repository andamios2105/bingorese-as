import QRCode from "qrcode";
import { BingoTable } from "@/types/database";
import { daysUntil, formatDrawDate } from "@/lib/validation";

export default async function TablePrizeInfo({
  table,
  qrUrl,
}: {
  table: BingoTable;
  qrUrl?: string | null;
}) {
  const hasInfo = !!(table.prize || table.lottery_name || table.draw_date || table.keyword);
  if (!hasInfo && !qrUrl) return null;

  const days = daysUntil(table.draw_date);
  const qrDataUrl = qrUrl
    ? await QRCode.toDataURL(qrUrl, { margin: 1, width: 120, color: { dark: "#0f172a", light: "#ffffff" } })
    : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 p-4 text-white shadow-xl">
      {hasInfo && (
        <div className="min-w-0 flex-1">
          {table.prize && <p className="text-lg font-extrabold leading-tight">🎁 Premio: {table.prize}</p>}
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
          {table.keyword && (
            <p className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-semibold">
              🔑 Palabra clave: <span className="font-bold">{table.keyword}</span>
            </p>
          )}
        </div>
      )}

      {qrDataUrl && (
        <a
          href={qrUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-white/10 p-2"
        >
          {table.business_name && (
            <p className="max-w-[5.5rem] truncate text-center text-[10px] font-semibold">{table.business_name}</p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR para dejar una reseña en Google Maps" className="h-16 w-16 rounded" />
          <p className="max-w-[5.5rem] text-center text-[9px] leading-tight text-violet-100">
            QR para reseñas o nombre de empresa
          </p>
        </a>
      )}
    </div>
  );
}
