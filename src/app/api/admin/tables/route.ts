import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;
  const businessName: string | null = body?.businessName ?? null;
  const googleMapsUrl: string | null = body?.googleMapsUrl ?? null;
  const prize: string | null = body?.prize ?? null;
  const lotteryName: string | null = body?.lotteryName ?? null;
  const drawDate: string | null = body?.drawDate ?? null;
  const keyword: string | null = body?.keyword ?? null;
  const bonusRate: number = Number(body?.bonusRate) || 0;

  if (!name?.trim()) {
    return NextResponse.json({ error: "El tablero necesita un nombre." }, { status: 400 });
  }
  if (bonusRate < 0) {
    return NextResponse.json({ error: "El bono extra no puede ser negativo." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_create_table", {
    p_name: name.trim(),
    p_business_name: businessName,
    p_google_maps_url: googleMapsUrl,
    p_prize: prize,
    p_lottery_name: lotteryName,
    p_draw_date: drawDate,
    p_keyword: keyword,
    p_bonus_rate: bonusRate,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ table: data }, { status: 201 });
}
