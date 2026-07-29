"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toTitleCase } from "@/lib/validation";
import { compressImageFile } from "@/lib/image";

export default function ReviewModal({
  tableId,
  cellNumber,
  onClose,
}: {
  tableId: string;
  cellNumber: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [googleProfileName, setGoogleProfileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Sube una captura de pantalla de la reseña.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró, vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const uploadFile = await compressImageFile(file);
    const ext = uploadFile.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("review-screenshots")
      .upload(path, uploadFile, { contentType: uploadFile.type });

    if (uploadError) {
      setError(`No se pudo subir la captura: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("review-screenshots").getPublicUrl(path);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId,
        cellNumber,
        googleProfileName,
        screenshotUrl: publicUrlData.publicUrl,
      }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo registrar la reseña.");
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Casilla #{cellNumber}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Nombre exacto del perfil de Google
            </label>
            <input
              required
              value={googleProfileName}
              onChange={(e) => setGoogleProfileName(e.target.value)}
              onBlur={(e) => setGoogleProfileName(toTitleCase(e.target.value))}
              placeholder="Ej: María Camila Ríos"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Debe coincidir con el nombre que aparece en Google Maps.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Captura de pantalla de la reseña
            </label>
            <label
              htmlFor="review-screenshot-input"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300 active:scale-95"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg">
                📷
              </span>
              <span className="truncate">{file ? file.name : "Tomar foto o subir captura"}</span>
            </label>
            <input
              id="review-screenshot-input"
              required
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <p className="mt-1 text-xs text-slate-500">Toma un pantallazo de la reseña tal como aparece en Google Maps.</p>
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <p className="text-xs text-slate-500">
            Tu reseña quedará en <span className="font-semibold text-amber-400">verificación (48–72h)</span> antes de
            marcarse como válida.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Reclamar casilla"}
          </button>
        </form>
      </div>
    </div>
  );
}
