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
  const promoterEmail: string | undefined = body?.promoterEmail;

  if (!promoterEmail?.trim()) {
    return NextResponse.json({ error: "Indica el correo del empleado." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_grant_table_access", {
    p_table_id: params.id,
    p_promoter_email: promoterEmail.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ access: data }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

  const { error } = await supabase.rpc("admin_revoke_table_access", {
    p_table_id: params.id,
    p_promoter_id: promoterId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
