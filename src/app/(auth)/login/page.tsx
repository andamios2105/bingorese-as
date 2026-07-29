"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function getGpsPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60_000 }
    );
  });
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      setLoading(false);
      return;
    }

    // Registra la sesión (IP aproximada siempre; GPS exacto solo si el
    // navegador ya tiene permiso concedido — si no, esto no pide nada
    // nuevo, simplemente no manda coordenadas). Nunca bloquea el login.
    const position = await getGpsPosition();
    await fetch("/api/auth/log-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        position
          ? {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }
          : {}
      ),
    }).catch(() => {});

    router.refresh();
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-2xl">
            🎯
          </div>
          <h1 className="text-2xl font-bold">Bingo de Reseñas</h1>
          <p className="mt-1 text-sm text-slate-400">Inicia sesión para ver tu cartón</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-slate-900 p-6 shadow-xl">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base outline-none focus:border-emerald-500"
              placeholder="••••••••"
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
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Al iniciar sesión registramos tu ubicación aproximada (IP) y, si lo permites en tu navegador, tu
            ubicación exacta — por seguridad y prevención de fraude.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-semibold text-emerald-400">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}
