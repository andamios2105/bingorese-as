import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const fullName: string | undefined = body?.fullName;
  const phone: string | null = body?.phone ?? null;
  const paymentMethod: string | null = body?.paymentMethod ?? null;
  const paymentNumber: string | null = body?.paymentNumber ?? null;
  const newPassword: string | undefined = body?.newPassword;

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "El empleado necesita un nombre." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_update_promoter_profile", {
    p_promoter_id: params.id,
    p_full_name: fullName,
    p_phone: phone,
    p_payment_method: paymentMethod,
    p_payment_number: paymentNumber,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.trim().length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    // La función de arriba ya confirmó que este usuario es admin (raise
    // exception si no lo es), pero volvemos a validarlo explícitamente
    // antes de usar el cliente con service_role, que bypassa RLS.
    const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede cambiar contraseñas." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error: passwordError } = await admin.auth.admin.updateUserById(params.id, {
      password: newPassword.trim(),
    });

    if (passwordError) {
      return NextResponse.json({ error: passwordError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { error } = await supabase.rpc("admin_delete_promoter", { p_promoter_id: params.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
