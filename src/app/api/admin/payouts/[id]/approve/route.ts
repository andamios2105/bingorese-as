import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const paymentProofUrl: string | null = body?.paymentProofUrl ?? null;

  // admin_approve_payout marca el pago como aprobado Y resetea el cartón
  // (verified_count = 0, cycle_number + 1) en la misma transacción SQL.
  const { data, error } = await supabase.rpc("admin_approve_payout", {
    p_payout_id: params.id,
    p_payment_proof_url: paymentProofUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ payout: data });
}
