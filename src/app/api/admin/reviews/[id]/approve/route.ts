import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToPromoter } from "@/lib/push";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // admin_approve_review verifica internamente que el usuario tenga role='admin'
  const { data, error } = await supabase.rpc("admin_approve_review", {
    p_review_id: params.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data?.promoter_id) {
    await sendPushToPromoter(data.promoter_id, {
      title: "✅ Reseña validada",
      body: "Tu reseña fue validada. ¡Sigue reclamando casillas!",
      url: "/dashboard",
    }).catch(() => {});
  }

  return NextResponse.json({ review: data });
}
