import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppSettings, BingoTable, TableGridCell } from "@/types/database";
import ClaimableBingoGrid from "@/components/ClaimableBingoGrid";
import TablePrizeInfo from "@/components/TablePrizeInfo";

const STATUS_TEXT: Record<BingoTable["status"], string> = {
  active: "activo",
  paused: "pausado",
  full: "lleno",
  archived: "archivado",
};

export default async function TableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: table }, { data: settings }] = await Promise.all([
    supabase.from("bingo_tables").select("*").eq("id", params.id).maybeSingle<BingoTable>(),
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle<AppSettings>(),
  ]);

  if (!table) notFound();

  const { data: cells } = await supabase
    .from("table_grid_view")
    .select("*")
    .eq("table_id", params.id)
    .returns<TableGridCell[]>();

  const claimed = cells?.length ?? 0;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6">
      <header className="mb-5">
        <Link href="/dashboard" className="text-xs text-slate-500">
          &larr; Volver
        </Link>
        <h1 className="mt-1 text-lg font-bold">{table.name}</h1>
        <p className="text-xs text-slate-500">{claimed}/100 casillas reclamadas</p>
      </header>

      <div className="mb-5">
        <TablePrizeInfo
          table={table}
          qrUrl={table.google_maps_url ?? settings?.google_business_reviews_url ?? null}
        />
      </div>

      <ClaimableBingoGrid tableId={table.id} cells={cells ?? []} interactive={table.status === "active"} />

      <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> En verificación
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Verificada
        </span>
      </div>

      {table.status !== "active" && (
        <p className="mt-3 text-center text-xs text-amber-400">
          Este tablero está {STATUS_TEXT[table.status]}. No se pueden reclamar más casillas.
        </p>
      )}
    </main>
  );
}
