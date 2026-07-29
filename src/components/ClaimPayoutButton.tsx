"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canClaimPayout, currentPayoutAmount, formatCOP, payoutRateForCount } from "@/lib/validation";

export default function ClaimPayoutButton({
  verifiedCount,
  hasPaymentMethod,
  hasPendingRequest,
}: {
  verifiedCount: number;
  hasPaymentMethod: boolean;
  hasPendingRequest: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya tiene una solicitud pendiente esperando aprobación — se muestra en
  // MyPayoutRequests, no tiene sentido ofrecer "cobrar" otra vez aquí.
  if (hasPendingRequest) return null;
  if (!canClaimPayout(verifiedCount)) return null;

  const amount = currentPayoutAmount(verifiedCount);
  const rate = payoutRateForCount(verifiedCount);

  async function confirmClaim() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payouts/request", { method: "POST" });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo enviar la solicitud.");
      return;
    }

    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-slate-950 shadow-lg">
      <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Puedes cobrar</p>
      <p className="text-2xl font-bold">{formatCOP(amount)}</p>
      <p className="text-xs opacity-80">
        {verifiedCount} reseñas × {formatCOP(rate)}
      </p>

      {!hasPaymentMethod && (
        <p className="mt-2 rounded-lg bg-slate-950/10 px-3 py-2 text-sm">
          Configura tu método de pago (Nequi/Daviplata) más abajo antes de reclamar.
        </p>
      )}

      {!confirming ? (
        <button
          disabled={!hasPaymentMethod}
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-xl bg-slate-950 py-3 font-semibold text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reclamar pago
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-950/90 p-3 text-slate-100">
          <p className="text-sm">
            Al confirmar, tu contador de reseñas{" "}
            <span className="font-semibold text-amber-400">volverá a 0</span> para iniciar un nuevo ciclo una vez el
            pago sea aprobado. ¿Confirmas el cobro de {formatCOP(amount)}?
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmClaim}
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-500 py-2 font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Sí, confirmar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg bg-slate-800 py-2 font-semibold text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
