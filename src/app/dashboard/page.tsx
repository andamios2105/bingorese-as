import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BingoTable, PayoutRequest, Profile, PromoterProgress, ReviewLog, TableAccess } from "@/types/database";
import ProgressBar from "@/components/ProgressBar";
import ClaimPayoutButton from "@/components/ClaimPayoutButton";
import MyPayoutRequests from "@/components/MyPayoutRequests";
import PayoutHistory from "@/components/PayoutHistory";
import PaymentMethodForm from "@/components/PaymentMethodForm";
import RecentReviews from "@/components/RecentReviews";
import LogoutButton from "@/components/LogoutButton";
import RequestAccessButton from "@/components/RequestAccessButton";
import EnableNotificationsButton from "@/components/EnableNotificationsButton";
import OnboardingTour from "@/components/OnboardingTour";
import { currentPayoutAmount, daysUntil, formatCOP, formatDateTime } from "@/lib/validation";

const STATUS_BADGE: Record<BingoTable["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  paused: "bg-sky-500/15 text-sky-400",
  full: "bg-amber-500/15 text-amber-400",
  archived: "bg-slate-700 text-slate-400",
};

const STATUS_LABEL: Record<BingoTable["status"], string> = {
  active: "Activo",
  paused: "Pausado",
  full: "Lleno",
  archived: "Archivado",
};

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let [{ data: profile }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("promoter_progress").select("*").eq("promoter_id", user.id).maybeSingle<PromoterProgress>(),
  ]);

  // Autorreparación: crea perfil/progreso si por alguna razón no existen.
  if (!profile || !progress) {
    const { data: repaired } = await supabase.rpc("ensure_promoter_setup");
    progress = (repaired as PromoterProgress | null) ?? progress;

    if (!profile) {
      const { data: repairedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<Profile>();
      profile = repairedProfile;
    }
  }

  const isTemporarilyFined =
    !!profile && !profile.is_suspended && !!profile.suspended_until && new Date(profile.suspended_until) > new Date();

  if (profile?.is_suspended || isTemporarilyFined) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 text-4xl">🚫</div>
        <h1 className="text-lg font-bold">Tu cuenta está suspendida</h1>
        <p className="mt-2 text-sm text-slate-400">
          {profile?.is_suspended
            ? "El administrador suspendió tu cuenta. No puedes reclamar casillas, pedir acceso a tableros ni cobrar hasta que te reactiven."
            : `Tu cuenta está suspendida temporalmente hasta el ${formatDateTime(profile?.suspended_until ?? null)}.`}
        </p>
        <LogoutButton />
      </main>
    );
  }

  const verifiedCount = progress?.verified_count ?? 0;

  const [{ data: tables }, { data: myAccess }] = await Promise.all([
    supabase.from("bingo_tables").select("*").order("created_at", { ascending: false }).returns<BingoTable[]>(),
    supabase.from("table_access").select("table_id, status").eq("promoter_id", user.id).returns<TableAccess[]>(),
  ]);

  const myAccessByTable = new Map((myAccess ?? []).map((a) => [a.table_id, a.status]));

  const tableIds = (tables ?? []).map((t) => t.id);
  const claimedByTable: Record<string, number> = {};
  if (tableIds.length > 0) {
    const { data: gridRows } = await supabase.from("table_grid_view").select("table_id").in("table_id", tableIds);
    (gridRows ?? []).forEach((r) => {
      claimedByTable[r.table_id] = (claimedByTable[r.table_id] ?? 0) + 1;
    });
  }

  const myTables = (tables ?? []).filter((t) => myAccessByTable.get(t.id) === "approved");
  const availableTables = (tables ?? []).filter((t) => t.status === "active" && !myAccessByTable.has(t.id));
  const requestedTables = (tables ?? []).filter((t) => myAccessByTable.get(t.id) === "requested");

  const [{ data: reviews }, { data: myPayouts }] = await Promise.all([
    supabase
      .from("reviews_log")
      .select("*")
      .eq("promoter_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(20)
      .returns<ReviewLog[]>(),
    supabase
      .from("payout_requests")
      .select("*")
      .eq("promoter_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(30)
      .returns<PayoutRequest[]>(),
  ]);

  const hasPendingPayout = (myPayouts ?? []).some((p) => p.status === "pending");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Hola,</p>
          <h1 className="text-lg font-bold">{profile?.full_name ?? "Promotor"}</h1>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400"
            >
              Panel admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      <div className="mb-5">
        <OnboardingTour />
      </div>

      <section className="mb-5">
        <EnableNotificationsButton />
      </section>

      <section className="mb-5 rounded-2xl bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-3xl font-extrabold text-emerald-400">{formatCOP(currentPayoutAmount(verifiedCount))}</p>
          <p className="text-sm text-slate-500">{verifiedCount} reseñas verificadas</p>
        </div>
        <ProgressBar verifiedCount={verifiedCount} />
        <p className="mt-2 text-xs text-slate-500">Llevas acumulado desde tu último cobro.</p>
      </section>

      <section className="mb-5 space-y-4">
        <MyPayoutRequests payouts={myPayouts ?? []} />
        <ClaimPayoutButton
          verifiedCount={verifiedCount}
          hasPaymentMethod={!!profile?.payment_method}
          hasPendingRequest={hasPendingPayout}
        />
        <PayoutHistory payouts={myPayouts ?? []} />
      </section>

      <section className="mb-5">
        <PaymentMethodForm
          initialMethod={profile?.payment_method ?? null}
          initialNumber={profile?.payment_number ?? null}
        />
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Tus tableros</h2>
        {myTables.length === 0 ? (
          <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-500">
            Aún no tienes acceso a ningún tablero. Postúlate a uno disponible más abajo, o pídele al administrador
            que te dé acceso.
          </p>
        ) : (
          <ul className="space-y-3">
            {myTables.map((t) => {
              const claimed = claimedByTable[t.id] ?? 0;
              const days = daysUntil(t.draw_date);
              return (
                <li key={t.id}>
                  <Link href={`/dashboard/tables/${t.id}`} className="block rounded-2xl bg-slate-900 p-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{t.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    {(t.prize || days !== null) && (
                      <p className="mt-1 text-xs text-violet-400">
                        {t.prize}
                        {days !== null && (t.prize ? " · " : "")}
                        {days !== null && (days > 0 ? `faltan ${days} días` : days === 0 ? "juega hoy" : "ya jugó")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{claimed}/100 casillas reclamadas</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Ver tablas activas</h2>
        {availableTables.length === 0 && requestedTables.length === 0 ? (
          <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-500">
            No hay tablas activas disponibles por ahora. Vuelve a revisar más tarde.
          </p>
        ) : (
          <ul className="space-y-3">
            {requestedTables.map((t) => (
              <li key={t.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{t.name}</p>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">
                    Solicitud enviada
                  </span>
                </div>
                {t.prize && <p className="mt-1 text-xs text-violet-400">{t.prize}</p>}
                <p className="mt-1 text-xs text-slate-500">Esperando aprobación del administrador.</p>
              </li>
            ))}
            {availableTables.map((t) => (
              <li key={t.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.name}</p>
                  <RequestAccessButton tableId={t.id} />
                </div>
                {t.prize && <p className="mt-1 text-xs text-violet-400">{t.prize}</p>}
                <p className="mt-1 text-xs text-slate-500">Postúlate para poder reclamar casillas aquí.</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <RecentReviews reviews={reviews ?? []} />
      </section>
    </main>
  );
}
