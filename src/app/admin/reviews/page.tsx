import { createClient } from "@/lib/supabase/server";
import ReviewVerificationList, { PendingReviewItem } from "@/components/admin/ReviewVerificationList";
import BusinessLinkSettings from "@/components/admin/BusinessLinkSettings";
import { AppSettings } from "@/types/database";

export default async function AdminReviewsPage() {
  const supabase = createClient();

  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase
      .from("reviews_log")
      .select(
        "id, google_profile_name_raw, screenshot_url, submitted_at, cell_number, bingo_tables(name), profiles:promoter_id(full_name, email)"
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle<AppSettings>(),
  ]);

  const reviews: PendingReviewItem[] = (data ?? []).map((r: any) => ({
    id: r.id,
    google_profile_name_raw: r.google_profile_name_raw,
    screenshot_url: r.screenshot_url,
    submitted_at: r.submitted_at,
    cell_number: r.cell_number,
    table_name: r.bingo_tables?.name ?? "—",
    promoter_name: r.profiles?.full_name ?? "—",
    promoter_email: r.profiles?.email ?? "—",
  }));

  if (error) {
    return <p className="py-8 text-center text-sm text-red-400">Error cargando reseñas: {error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="pt-2 text-lg font-bold">Verificación de reseñas</h2>
      <BusinessLinkSettings initialUrl={settings?.google_business_reviews_url ?? null} />
      <p className="text-sm text-slate-500">
        Compara la captura subida contra el listado real de Google Maps y aprueba o rechaza.
      </p>
      <ReviewVerificationList reviews={reviews} />
    </div>
  );
}
