"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "@/lib/validation";

const SEEN_KEY = "bingo_onboarding_seen_v1";

const STEPS = [
  {
    icon: "🎯",
    title: "¡Bienvenido al Bingo de Reseñas!",
    body: "Cada casilla que reclamas es una reseña real que consigues para el negocio en Google Maps. Entre más reseñas verificadas acumules, más dinero puedes cobrar.",
  },
  {
    icon: "🧩",
    title: "Reclama una casilla",
    body: "Entra a uno de tus tableros y toca cualquier número libre. Esa casilla queda apartada para ti — nadie más te la puede quitar mientras la estés tramitando.",
  },
  {
    icon: "📸",
    title: "Sube el nombre y la captura",
    body: "Escribe el nombre exacto del perfil de Google que dejó la reseña y sube una captura de pantalla de esa reseña. No necesitas ningún link, solo la foto.",
  },
  {
    icon: "⏳",
    title: "Verificación 48–72h",
    body: "El administrador revisa tu captura contra el listado real de Google Maps. Si todo coincide, tu reseña queda \"verificada\" y suma a tu total. Si algo no cuadra, te la rechaza con el motivo y liberas la casilla para intentar de nuevo.",
  },
  {
    icon: "💰",
    title: "Cobra tu progreso",
    body: `Necesitas mínimo 10 reseñas verificadas para poder cobrar. La tarifa por reseña sube mientras más acumules: ${formatCOP(800)} c/u hasta 29, ${formatCOP(1100)} desde 30, ${formatCOP(1300)} desde 50, y ${formatCOP(1500)} desde 100 en adelante — aplica a TODAS tus reseñas acumuladas, no solo las nuevas.`,
  },
  {
    icon: "🔔",
    title: "Activa las notificaciones",
    body: "Actívalas en tu panel para enterarte al instante cuando te den acceso a un tablero nuevo, o cuando el admin valide o rechace una de tus reseñas.",
  },
];

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!window.localStorage.getItem(SEEN_KEY)) {
      setVisible(true);
    }
  }, []);

  function close() {
    window.localStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
    setStep(0);
  }

  function next() {
    if (step === STEPS.length - 1) {
      close();
    } else {
      setStep((s) => s + 1);
    }
  }

  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <>
      <button
        onClick={() => {
          setStep(0);
          setVisible(true);
        }}
        className="text-xs text-slate-500 underline underline-offset-2"
      >
        ¿Cómo funciona esto?
      </button>

      {visible && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Paso {step + 1} de {STEPS.length}
              </span>
              <button onClick={close} aria-label="Cerrar guía" className="text-2xl leading-none text-slate-500">
                &times;
              </button>
            </div>

            <div className="mb-6 text-center">
              <div className="mb-3 text-5xl">{STEPS[step].icon}</div>
              <h2 className="mb-2 text-lg font-bold">{STEPS[step].title}</h2>
              <p className="text-sm leading-relaxed text-slate-400">{STEPS[step].body}</p>
            </div>

            <div className="mb-5 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-emerald-400" : "bg-slate-700"}`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300"
                >
                  Anterior
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950"
              >
                {step === STEPS.length - 1 ? "Finalizar" : "Siguiente"}
              </button>
            </div>

            {step < STEPS.length - 1 && (
              <button onClick={close} className="mt-3 w-full text-center text-xs text-slate-500">
                Saltar guía
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
