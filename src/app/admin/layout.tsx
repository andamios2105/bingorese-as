import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
            className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 font-medium text-slate-300 hover:bg-slate-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="mx-auto max-w-3xl px-4">{children}</main>
    </div>
  );
}
