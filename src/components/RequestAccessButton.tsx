"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestAccessButton({ tableId }: { tableId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/tables/${tableId}/request-access`, { method: "POST" });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo enviar la solicitud.");
      return;
    }

    router.refresh();
  }

  return (
    <div onClick={(e) => e.preventDefault()}>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? "..." : "Postularse"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
