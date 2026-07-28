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
  const tableId: string | undefined = body?.tableId;
  const cellNumber: number | undefined = body?.cellNumber;
  const googleProfileName: string | undefined = body?.googleProfileName;
  const screenshotUrl: string | undefined = body?.screenshotUrl;

  if (!tableId || !cellNumber || !googleProfileName?.trim() || !screenshotUrl?.trim()) {
    return NextResponse.json(
      { error: "Faltan datos: tablero, casilla, nombre de Google y captura de pantalla son obligatorios." },
      { status: 400 }
    );
  }

  // Toda la lógica anti-fraude (acceso al tablero, casilla disponible,
  // unicidad global del nombre de Google) vive en la función SQL
  // submit_review — el route handler solo traduce el error a texto legible.
  const { data, error } = await supabase.rpc("submit_review", {
    p_table_id: tableId,
    p_cell_number: cellNumber,
    p_google_profile_name: googleProfileName.trim(),
    p_screenshot_url: screenshotUrl.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
