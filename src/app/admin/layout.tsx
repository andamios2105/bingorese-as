import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [{ count: pendingReviews }, { count: pendingPayouts }, { count: pendingAccess }] = await Promise.all([
    supabase.from("reviews_log").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payout_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("table_access").select("*", { count: "exact", head: true }).eq("status", "requested"),
  ]);

  const pendingByHref: Record<string, number> = {
    "/admin/reviews": pendingReviews ?? 0,
    "/admin/payouts": pendingPayouts ?? 0,
    "/admin/tables": pendingAccess ?? 0,
  };

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-base font-bold">Panel Admin — Bingo de Reseñas</h1>
          <LogoutButton />
        </div>
      </header>

      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-3 text-sm">
        {[
          { href: "/admin", label: "Resumen" },
          { href: "/admin/employees", label: "Empleados" },
          { href: "/admin/tables", label: "Tableros" },
          { href: "/admin/reviews", label: "Verificar reseñas" },
          { href: "/admin/payouts", label: "Cobros pendientes" },
          { href: "/admin/audit", label: "Auditoría" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="relative whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 font-medium text-slate-300 hover:bg-slate-800"
          >
            {(pendingByHref[item.href] ?? 0) > 0 && (
              <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-950" />
            )}
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="mx-auto max-w-3xl px-4">{children}</main>
    </div>
  );
}
