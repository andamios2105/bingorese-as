"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AccessMember {
  promoter_id: string;
  full_name: string;
  email: string;
}

export default function TableAccessManager({
  tableId,
  members,
  pendingRequests,
}: {
  tableId: string;
  members: AccessMember[];
  pendingRequests: AccessMember[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grantAccess(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/tables/${tableId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoterEmail: email }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    setEmail("");
    router.refresh();
  }

  async function approveRequest(promoterId: string) {
    setBusyId(promoterId);
    setError(null);

    const res = await fetch(`/api/admin/tables/${tableId}/access/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoterId }),
    });
    const body = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    router.refresh();
  }

  async function removeAccess(promoterId: string) {
    setBusyId(promoterId);
    setError(null);

    const res = await fetch(`/api/admin/tables/${tableId}/access`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoterId }),
    });
    const body = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      {pendingRequests.length > 0 && (
        <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
          <h3 className="mb-2 text-sm font-semibold text-amber-400">
            Solicitudes pendientes ({pendingRequests.length})
          </h3>
          <ul className="space-y-2">
            {pendingRequests.map((m) => (
              <li key={m.promoter_id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => approveRequest(m.promoter_id)}
                    disabled={busyId === m.promoter_id}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => removeAccess(m.promoter_id)}
                    disabled={busyId === m.promoter_id}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Empleados con acceso</h3>

        <form onSubmit={grantAccess} className="mb-3 flex gap-2">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@empleado.com"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? "..." : "Dar acceso"}
          </button>
        </form>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        {members.length === 0 ? (
          <p className="text-sm text-slate-500">Ningún empleado tiene acceso todavía.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.promoter_id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                </div>
                <button
                  onClick={() => removeAccess(m.promoter_id)}
                  disabled={busyId === m.promoter_id}
                  className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
