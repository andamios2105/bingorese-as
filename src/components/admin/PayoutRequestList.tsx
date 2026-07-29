"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/image";
import { formatCOP } from "@/lib/validation";
import { AdminPayoutRequestView } from "@/types/database";

export default function PayoutRequestList({ payouts }: { payouts: AdminPayoutRequestView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});

  async function approve(id: string, promoterId: string) {
    setBusyId(id);
    setError(null);

    let paymentProofUrl: string | null = null;
    const file = proofFiles[id];

    if (file) {
      const supabase = createClient();
      const uploadFile = await compressImageFile(file);
      const ext = uploadFile.name.split(".").pop() || "jpg";
      const path = `${promoterId}/${id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, uploadFile, { contentType: uploadFile.type });

      if (uploadError) {
        setError(`No se pudo subir el comprobante: ${uploadError.message}`);
        setBusyId(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      paymentProofUrl = publicUrlData.publicUrl;
    }

    const res = await fetch(`/api/admin/payouts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentProofUrl }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    router.refresh();
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/payouts/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Rechazado por administrador" }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    router.refresh();
  }

  if (payouts.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No hay solicitudes de cobro pendientes.</p>;
  }

  return (
    <ul className="space-y-3 py-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {payouts.map((p) => (
        <li key={p.id} className="rounded-2xl bg-slate-900 p-4 shadow-xl">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="font-semibold">{p.full_name}</p>
              <p className="text-xs text-slate-500">{p.email}</p>
            </div>
            <p className="text-xl font-extrabold text-emerald-400">{formatCOP(p.amount)}</p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-800 px-3 py-2">
              <p className="text-slate-500">Reseñas × tarifa</p>
              <p className="font-semibold">
                {p.reviews_count} × {formatCOP(p.rate_applied)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 px-3 py-2 capitalize">
              <p className="text-slate-500">Pago a</p>
              <p className="font-semibold">
                {p.payment_method} · {p.payment_number}
              </p>
            </div>
          </div>

          <div className="mb-2">
            <label
              htmlFor={`proof-${p.id}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300"
            >
              📎 {proofFiles[p.id] ? proofFiles[p.id]!.name : "Adjuntar captura del pago (opcional)"}
            </label>
            <input
              id={`proof-${p.id}`}
              type="file"
              accept="image/*"
              onChange={(e) => setProofFiles((prev) => ({ ...prev, [p.id]: e.target.files?.[0] ?? null }))}
              className="sr-only"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => approve(p.id, p.promoter_id)}
              disabled={busyId === p.id}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busyId === p.id ? "..." : "Aprobar pago y resetear cartón"}
            </button>
            <button
              onClick={() => reject(p.id)}
              disabled={busyId === p.id}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
