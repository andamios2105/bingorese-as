"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmployeeButton({ promoterId }: { promoterId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/employees/${promoterId}/verify`, { method: "POST" });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo verificar.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? "..." : "Verificar cuenta"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
