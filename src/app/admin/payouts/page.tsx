import { createClient } from "@/lib/supabase/server";
import PayoutRequestList from "@/components/admin/PayoutRequestList";
import { AdminPayoutRequestView } from "@/types/database";

export default async function AdminPayoutsPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("admin_payout_requests_view")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .returns<AdminPayoutRequestView[]>();

  if (error) {
    return <p className="py-8 text-center text-sm text-red-400">Error cargando cobros: {error.message}</p>;
  }

  return (
    <div>
      <h2 className="pt-2 text-lg font-bold">Solicitudes de cobro pendientes</h2>
      <p className="text-sm text-slate-500">
        Al aprobar, el pago queda registrado como histórico y el cartón del promotor se reinicia a 0/100.
      </p>
      <PayoutRequestList payouts={data ?? []} />
    </div>
  );
}
