"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PaymentMethodForm({
  initialMethod,
  initialNumber,
}: {
  initialMethod: string | null;
  initialNumber: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [method, setMethod] = useState(initialMethod ?? "nequi");
  const [number, setNumber] = useState(initialNumber ?? "");
  const [savedMethod, setSavedMethod] = useState(initialMethod);
  const [savedNumber, setSavedNumber] = useState(initialNumber);
  const [editing, setEditing] = useState(!initialMethod || !initialNumber);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("profiles")
      .update({ payment_method: method, payment_number: number })
      .eq("id", user?.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSavedMethod(method);
    setSavedNumber(number);
    setEditing(false);
    router.refresh();
  }

  if (!editing && savedMethod && savedNumber) {
    return (
      <div className="rounded-2xl bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Método de pago</h3>
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-400">✓ Cuenta registrada correctamente</p>
          <p className="mt-1 text-sm capitalize text-slate-200">
            {savedMethod} · {savedNumber}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-slate-200"
        >
          Cambiar método de pago
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-slate-900 p-4 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-300">Método de pago</h3>
      <div className="flex gap-2">
        {(["nequi", "daviplata"] as const).map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => setMethod(opt)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition ${
              method === opt ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <input
        required
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Número de celular asociado"
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        {savedMethod && savedNumber && (
          <button
            type="button"
            onClick={() => {
              setMethod(savedMethod);
              setNumber(savedNumber);
              setEditing(false);
              setError(null);
            }}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 font-semibold text-slate-300"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-slate-100 py-2.5 font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
