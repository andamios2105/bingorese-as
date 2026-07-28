import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cellNumber: number | undefined = body?.cellNumber;
  const promoterId: string | undefined = body?.promoterId;
  const note: string | undefined = body?.note;

  if (!cellNumber || !promoterId) {
    return NextResponse.json({ error: "Falta la casilla o el empleado." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_assign_cell", {
    p_table_id: params.id,
    p_cell_number: cellNumber,
    p_promoter_id: promoterId,
    p_note: note ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
