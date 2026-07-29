import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BingoTable, TableStatus } from "@/types/database";
import CreateTableForm from "@/components/admin/CreateTableForm";
import TableQuickActions from "@/components/admin/TableQuickActions";
import { daysUntil } from "@/lib/validation";

const STATUS_BADGE: Record<TableStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  paused: "bg-sky-500/15 text-sky-400",
  full: "bg-amber-500/15 text-amber-400",
  archived: "bg-slate-700 text-slate-400",
};

const STATUS_LABEL: Record<TableStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  full: "Lleno",
  archived: "Archivado",
};

const TABS: { status: TableStatus; heading: string; icon: string; activePill: string }[] = [
  { status: "active", heading: "Activos", icon: "✅", activePill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
  { status: "paused", heading: "Pausados", icon: "⏸️", activePill: "bg-sky-500/15 text-sky-400 border-sky-500/40" },
  { status: "full", heading: "Llenos", icon: "🎯", activePill: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
  { status: "archived", heading: "Archivados", icon: "📦", activePill: "bg-slate-700 text-slate-300 border-slate-600" },
];

export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
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

  const countByStatus: Record<TableStatus, number> = { active: 0, paused: 0, full: 0, archived: 0 };
  (tables ?? []).forEach((t) => {
    countByStatus[t.status] += 1;
  });

  const activeStatus: TableStatus = (["active", "paused", "full", "archived"] as const).includes(
    searchParams.status as TableStatus
  )
    ? (searchParams.status as TableStatus)
    : "active";

  const visibleTables = (tables ?? []).filter((t) => t.status === activeStatus);

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-lg font-bold">Tableros</h2>
      <CreateTableForm />

      {!tables || tables.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Aún no has creado ningún tablero.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <Link
                key={tab.status}
                href={`/admin/tables?status=${tab.status}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  activeStatus === tab.status ? tab.activePill : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                {tab.icon} {tab.heading} ({countByStatus[tab.status]})
              </Link>
            ))}
          </div>

          {visibleTables.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No hay tableros {TABS.find((t) => t.status === activeStatus)?.heading.toLowerCase()}.
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleTables.map((t) => {
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
        </>
      )}
    </div>
  );
}
