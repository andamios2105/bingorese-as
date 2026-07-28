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
  const googleBusinessReviewsUrl: string | undefined = body?.googleBusinessReviewsUrl;

  const { data, error } = await supabase.rpc("admin_update_app_settings", {
    p_google_business_reviews_url: googleBusinessReviewsUrl ?? "",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ settings: data });
}
