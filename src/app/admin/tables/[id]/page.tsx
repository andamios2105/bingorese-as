import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppSettings, BingoTable, TableGridCell } from "@/types/database";
import AdminAssignableGrid from "@/components/admin/AdminAssignableGrid";
import TableAccessManager, { AccessMember } from "@/components/admin/TableAccessManager";
import TableManagementPanel from "@/components/admin/TableManagementPanel";
import TablePrizeInfo from "@/components/TablePrizeInfo";
import TableReviewQr from "@/components/TableReviewQr";

export default async function AdminTableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: table }, { data: adminProfile }, { data: settings }] = await Promise.all([
    supabase.from("bingo_tables").select("*").eq("id", params.id).maybeSingle<BingoTable>(),
    user
      ? supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle<AppSettings>(),
  ]);

  if (!table) notFound();

  const [{ data: cells }, { data: access }] = await Promise.all([
    supabase.from("table_grid_view").select("*").eq("table_id", params.id).returns<TableGridCell[]>(),
    supabase
      .from("table_access")
      .select("promoter_id, status, profiles(full_name, email)")
      .eq("table_id", params.id),
  ]);

  const currentAdmin: AccessMember | null = user
    ? {
        promoter_id: user.id,
        full_name: adminProfile?.full_name ? `${adminProfile.full_name} (tú)` : "Tú (admin)",
        email: adminProfile?.email ?? "",
      }
    : null;

  const toMember = (a: any): AccessMember => ({
    promoter_id: a.promoter_id,
    full_name: a.profiles?.full_name ?? "—",
    email: a.profiles?.email ?? "—",
  });

  const members: AccessMember[] = (access ?? []).filter((a: any) => a.status === "approved").map(toMember);
  const pendingRequests: AccessMember[] = (access ?? [])
    .filter((a: any) => a.status === "requested")
    .map(toMember);

  const claimed = cells?.length ?? 0;

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/admin/tables" className="text-xs text-slate-500">
            &larr; Volver a tableros
          </Link>
          <h2 className="mt-1 text-lg font-bold">{table.name}</h2>
          <p className="text-xs text-slate-500">
            {claimed}/100 casillas reclamadas · estado: {table.status}
          </p>
        </div>
        <TableReviewQr url={settings?.google_business_reviews_url ?? null} />
      </div>

      <TablePrizeInfo table={table} />

      <TableAccessManager tableId={table.id} members={members} pendingRequests={pendingRequests} />

      <AdminAssignableGrid tableId={table.id} cells={cells ?? []} members={members} currentAdmin={currentAdmin} />

      <TableManagementPanel table={table} claimedCount={claimed} />
    </div>
  );
}
