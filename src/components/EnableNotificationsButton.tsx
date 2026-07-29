"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function EnableNotificationsButton() {
  const [status, setStatus] = useState<"idle" | "unsupported" | "enabled" | "loading" | "error">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setStatus("enabled");
    });
  }, []);

  async function handleEnable() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setStatus("unsupported");
      return;
    }

    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) throw new Error("No se pudo guardar la suscripción.");
      setStatus("enabled");
    } catch {
      setStatus("error");
    }
  }

  if (status === "unsupported") {
    return (
      <p className="rounded-2xl bg-slate-900 p-4 text-xs text-slate-500">
        Tu navegador no admite notificaciones push. En iPhone, agrega esta página a tu pantalla de inicio primero
        (compartir → &quot;Agregar a inicio&quot;).
      </p>
    );
  }

  if (status === "enabled") {
    return (
      <p className="rounded-2xl bg-emerald-500/10 p-4 text-xs text-emerald-400">
        🔔 Notificaciones activadas. Te avisaremos aquí cuando pase algo importante.
      </p>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={status === "loading"}
      className="w-full rounded-2xl bg-slate-900 p-4 text-left text-sm font-semibold text-slate-300 shadow-xl disabled:opacity-60"
    >
      🔔 {status === "loading" ? "Activando..." : "Activar notificaciones"}
      {status === "error" && (
        <span className="mt-1 block text-xs font-normal text-rose-400">
          No se pudo activar. Revisa los permisos de notificaciones de tu navegador e inténtalo de nuevo.
        </span>
      )}
    </button>
  );
}
