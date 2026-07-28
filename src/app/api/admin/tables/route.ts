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

  if (!name?.trim()) {
    return NextResponse.json({ error: "El tablero necesita un nombre." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_create_table", { p_name: name.trim() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ table: data }, { status: 201 });
}
