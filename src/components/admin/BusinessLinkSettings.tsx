"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BusinessLinkSettings({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [editing, setEditing] = useState(!initialUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleBusinessReviewsUrl: url }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
      <h3 className="mb-2 text-sm font-semibold text-slate-300">Link fijo del negocio en Google Maps</h3>
      <p className="mb-3 text-xs text-slate-500">
        Ábrelo y busca con Ctrl+F el nombre de cada reseña para comparar contra la captura subida.
      </p>

      {editing ? (
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-sky-400 underline"
          >
            {url}
          </a>
          <button
            onClick={() => setEditing(true)}
            className="rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-300"
          >
            Editar
          </button>
        </div>
      )}
    </div>
  );
}
