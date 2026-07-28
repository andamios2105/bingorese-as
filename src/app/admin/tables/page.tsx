import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BingoTable } from "@/types/database";
import CreateTableForm from "@/components/admin/CreateTableForm";
import TableQuickActions from "@/components/admin/TableQuickActions";
import { daysUntil } from "@/lib/validation";

const STATUS_BADGE: Record<BingoTable["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  paused: "bg-sky-500/15 text-sky-400",
  full: "bg-amber-500/15 text-amber-400",
  archived: "bg-slate-700 text-slate-400",
};

const STATUS_LABEL: Record<BingoTable["status"], string> = {
  active: "Activo",
  paused: "Pausado",
  full: "Lleno",
  archived: "Archivado",
};

export default async function AdminTablesPage() {
  const supabase = createClient();

  const { data: tables } = await supabase
    .from("bingo_tables")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<BingoTable[]>();

  const tableIds = (tables ?? []).map((t) => t.id);
  const claimedByTable: Record<string, number> = {};
  const activeUsersByTable: Record<string, number> = {};
  const pendingRequestsByTable: Record<string, number> = {};

  if (tableIds.length > 0) {
    const [{ data: gridRows }, { data: accessRows }] = await Promise.all([
      supabase.from("table_grid_view").select("table_id").in("table_id", tableIds),
      supabase.from("table_access").select("table_id, status").in("table_id", tableIds),
    ]);

    (gridRows ?? []).forEach((r) => {
      claimedByTable[r.table_id] = (claimedByTable[r.table_id] ?? 0) + 1;
    });

    (accessRows ?? []).forEach((a) => {
      if (a.status === "approved") {
        activeUsersByTable[a.table_id] = (activeUsersByTable[a.table_id] ?? 0) + 1;
      } else {
        pendingRequestsByTable[a.table_id] = (pendingRequestsByTable[a.table_id] ?? 0) + 1;
      }
    });
  }

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-lg font-bold">Tableros</h2>
      <CreateTableForm />

      {!tables || tables.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Aún no has creado ningún tablero.</p>
      ) : (
        <ul className="space-y-3">
          {tables.map((t) => {
            const days = daysUntil(t.draw_date);
            return (
            <li key={t.id}>
              <Link href={`/admin/tables/${t.id}`} className="block rounded-2xl bg-slate-900 p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{t.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                {(t.prize || days !== null) && (
                  <p className="mt-1 text-xs text-violet-400">
                    {t.prize}
                    {days !== null && (t.prize ? " · " : "")}
                    {days !== null && (days > 0 ? `faltan ${days} días` : days === 0 ? "juega hoy" : "ya jugó")}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">{claimedByTable[t.id] ?? 0}/100 casillas reclamadas</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeUsersByTable[t.id] ?? 0} empleado(s) activo(s)
                  {(pendingRequestsByTable[t.id] ?? 0) > 0 && (
                    <span className="ml-1 font-semibold text-amber-400">
                      · {pendingRequestsByTable[t.id]} solicitud(es) pendiente(s)
                    </span>
                  )}
                </p>
              </Link>
              <TableQuickActions tableId={t.id} status={t.status} />
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
