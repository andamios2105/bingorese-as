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
  const days: number | undefined = body?.days;
  const reason: string | undefined = body?.reason;

  if (!days || days <= 0) {
    return NextResponse.json({ error: "Indica cuántos días de suspensión." }, { status: 400 });
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: "Escribe el motivo de la multa." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_fine_promoter", {
    p_promoter_id: params.id,
    p_days: days,
    p_reason: reason.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
