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

  const body = await request.json().catch(() => ({}));
  const reason: string = body?.reason?.trim() || "No especificado";

  const { data, error } = await supabase.rpc("admin_reject_review", {
    p_review_id: params.id,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data?.promoter_id) {
    await sendPushToPromoter(data.promoter_id, {
      title: "❌ Reseña rechazada",
      body: `Tu reseña fue rechazada. Motivo: ${reason}`,
      url: "/dashboard",
    }).catch(() => {});
  }

  return NextResponse.json({ review: data });
}
