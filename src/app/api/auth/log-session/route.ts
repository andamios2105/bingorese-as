import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface IpLookupResult {
  city?: string;
  region?: string;
  country_name?: string;
}

async function lookupIpLocation(ip: string): Promise<IpLookupResult | null> {
  // IPs locales/privadas no se pueden geolocalizar (desarrollo local, redes internas).
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as IpLookupResult;
  } catch {
    // Si el servicio de geolocalización por IP falla o se demora, no bloqueamos el login.
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const gpsLat: number | null = typeof body?.lat === "number" ? body.lat : null;
  const gpsLng: number | null = typeof body?.lng === "number" ? body.lng : null;
  const gpsAccuracy: number | null = typeof body?.accuracy === "number" ? body.accuracy : null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";

  const ipInfo = await lookupIpLocation(ip);

  const { error } = await supabase.rpc("log_login_session", {
    p_ip_address: ip || null,
    p_ip_city: ipInfo?.city ?? null,
    p_ip_region: ipInfo?.region ?? null,
    p_ip_country: ipInfo?.country_name ?? null,
    p_gps_lat: gpsLat,
    p_gps_lng: gpsLng,
    p_gps_accuracy_m: gpsAccuracy,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
