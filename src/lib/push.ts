import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Envía una notificación push a todos los dispositivos suscritos de un
 * empleado. Si el navegador ya no acepta un endpoint (410/404) se borra
 * esa suscripción para no reintentar en vano. Nunca lanza: un fallo de
 * push no debe romper la acción principal (aprobar reseña, dar acceso...).
 */
export async function sendPushToPromoter(promoterId: string, payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return;

  const admin = createAdminClient();

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("promoter_id", promoterId);

  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}
