import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = createClient();

  const [{ count: pendingReviews }, { count: pendingPayouts }, { count: totalPromoters }, { count: totalVerified }] =
    await Promise.all([
      supabase.from("reviews_log").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("payout_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "promoter"),
      supabase.from("reviews_log").select("*", { count: "exact", head: true }).eq("status", "verified"),
    ]);

  const cards = [
    { label: "Reseñas por verificar", value: pendingReviews ?? 0, href: "/admin/reviews", tone: "amber" },
    { label: "Cobros pendientes", value: pendingPayouts ?? 0, href: "/admin/payouts", tone: "emerald" },
    { label: "Promotores registrados", value: totalPromoters ?? 0, href: "/admin/audit", tone: "sky" },
    { label: "Reseñas verificadas (total)", value: totalVerified ?? 0, href: "/admin/audit", tone: "violet" },
  ] as const;

  const toneClasses: Record<string, string> = {
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    violet: "text-violet-400",
  };

  return (
    <div className="grid grid-cols-2 gap-3 py-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
          <p className={`text-3xl font-extrabold ${toneClasses[c.tone]}`}>{c.value}</p>
          <p className="mt-1 text-sm text-slate-400">{c.label}</p>
        </Link>
      ))}
    </div>
  );
}
