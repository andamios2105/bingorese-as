"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toTitleCase } from "@/lib/validation";

export default function CreateTableForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [prize, setPrize] = useState("");
  const [lotteryName, setLotteryName] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [bonusRate, setBonusRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        businessName,
        googleMapsUrl,
        prize,
        lotteryName,
        drawDate: drawDate || null,
        keyword,
        bonusRate: bonusRate ? Number(bonusRate) : 0,
      }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error);
      return;
    }

    setName("");
    setBusinessName("");
    setGoogleMapsUrl("");
    setPrize("");
    setLotteryName("");
    setDrawDate("");
    setKeyword("");
    setBonusRate("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-slate-900 p-4 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-300">Crear nuevo tablero</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del tablero</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => setName(toTitleCase(e.target.value))}
          placeholder="Ej: Tabla Enero 2026"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del negocio</label>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          onBlur={(e) => setBusinessName(toTitleCase(e.target.value))}
          placeholder="Ej: Restaurante El Buen Sabor"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Link de Google Maps (para el QR)</label>
        <input
          value={googleMapsUrl}
          onChange={(e) => setGoogleMapsUrl(e.target.value)}
          placeholder="https://www.google.com/maps/place/..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Premio</label>
        <input
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          onBlur={(e) => setPrize(toTitleCase(e.target.value))}
          placeholder="Ej: Nevera de 300L"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Lotería</label>
          <input
            value={lotteryName}
            onChange={(e) => setLotteryName(e.target.value)}
            onBlur={(e) => setLotteryName(toTitleCase(e.target.value))}
            placeholder="Ej: Lotería de Boyacá"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Fecha de juego</label>
          <input
            type="date"
            value={drawDate}
            onChange={(e) => setDrawDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Palabra clave</label>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Ej: Andamios Leguizamon"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <p className="mt-1 text-xs text-slate-500">La palabra o frase que cada reseña de este tablero debe mencionar.</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Bono extra por reseña (opcional)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={bonusRate}
          onChange={(e) => setBonusRate(e.target.value)}
          placeholder="Ej: 300"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Se suma a la tarifa normal por cada reseña verificada de este tablero — úsalo para incentivar a los
          empleados a llenarlo más rápido.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? "Creando..." : "Crear tablero"}
      </button>
    </form>
  );
}
