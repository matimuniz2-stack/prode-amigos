import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:prode@prodelospibes.com";

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
  return true;
}

/** Cliente service-role para mandar a TODOS (lee/borra subs cross-user). Null
 *  si no está configurado el service-role (degrada sin romper). */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envía una notificación a todas las suscripciones de los usuarios dados.
 *  Limpia las suscripciones vencidas (404/410). Nunca tira — devuelve conteos. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number; skipped?: string }> {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  if (!ensureVapid()) return { sent: 0, removed: 0, skipped: "no-vapid" };
  const sb = adminClient();
  if (!sb) return { sent: 0, removed: 0, skipped: "no-service-role" };

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(userIds)]);

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        // 404/410 = endpoint muerto → lo purgamos. El cleanup va en su propio
        // try para no romper el envío del resto (contrato: nunca tira).
        if (code === 404 || code === 410) {
          try {
            await sb.from("push_subscriptions").delete().eq("id", s.id);
            removed++;
          } catch {
            /* si falla el delete, lo intentamos la próxima corrida */
          }
        }
      }
    }),
  );

  return { sent, removed };
}
