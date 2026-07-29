"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toTitleCase } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          phone: form.phone,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <div className="max-w-sm rounded-2xl bg-slate-900 p-8 shadow-xl">
          <div className="mb-3 text-4xl">📩</div>
          <h1 className="text-xl font-bold">¡Casi listo!</h1>
          <p className="mt-2 text-sm text-slate-400">
            Revisa tu correo <span className="font-semibold text-slate-200">{form.email}</span> para confirmar tu
            cuenta antes de iniciar sesión.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-2xl">
            🎟️
          </div>
          <h1 className="text-2xl font-bold">Crea tu cuenta de Promotor</h1>
          <p className="mt-1 text-sm text-slate-400">Empieza a llenar tu cartón de reseñas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-slate-900 p-6 shadow-xl">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Nombre completo</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              onBlur={(e) => update("fullName", toTitleCase(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Correo</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Celular (Nequi/Daviplata)</label>
            <input
              required
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="300 123 4567"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-emerald-400">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
