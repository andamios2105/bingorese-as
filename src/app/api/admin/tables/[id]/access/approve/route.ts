import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToPromoter } from "@/lib/push";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const promoterId: string | undefined = body?.promoterId;

  if (!promoterId) {
    return NextResponse.json({ error: "Falta el id del empleado." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_approve_table_access", {
    p_table_id: params.id,
    p_promoter_id: promoterId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: table } = await supabase.from("bingo_tables").select("name").eq("id", params.id).maybeSingle();
  if (table?.name) {
    await sendPushToPromoter(promoterId, {
      title: "🎉 ¡Bienvenido!",
      body: `Ya tienes acceso al tablero "${table.name}". ¡Empieza a reclamar casillas!`,
      url: `/dashboard/tables/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ access: data });
}
