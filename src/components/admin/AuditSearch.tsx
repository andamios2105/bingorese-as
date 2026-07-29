"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeGoogleHandle } from "@/lib/validation";

interface RegistryHit {
  google_handle: string;
  google_profile_name_raw: string;
  status: string;
  registered_at: string;
  promoter_id: string;
}

export default function AuditSearch() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const handle = normalizeGoogleHandle(query);

    const { data } = await supabase
      .from("google_reviewers_registry")
      .select("google_handle, google_profile_name_raw, status, registered_at, promoter_id")
      .ilike("google_handle", `%${handle}%`)
      .limit(20);

    setResults(data ?? []);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
      <h3 className="mb-2 text-sm font-semibold text-slate-300">Buscar perfil de Google en el registro global</h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del perfil de Google..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "..." : "Buscar"}
        </button>
      </form>

      {results && (
        <ul className="mt-3 space-y-2">
          {results.length === 0 && (
            <p className="text-sm text-slate-500">Sin coincidencias — este perfil no ha reseñado antes.</p>
          )}
          {results.map((r) => (
            <li key={r.google_handle} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.google_profile_name_raw}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.status === "verified" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Registrado el {new Date(r.registered_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
