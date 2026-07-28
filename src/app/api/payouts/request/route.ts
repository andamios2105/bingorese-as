import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // request_payout() valida en el servidor (SQL) que verified_count sea
  // EXACTAMENTE 10/30/50/70/100 y que no haya ya una solicitud pendiente.
  const { data, error } = await supabase.rpc("request_payout");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ payout: data }, { status: 201 });
}
