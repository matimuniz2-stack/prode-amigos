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

/** Manda un push a TODOS los que tienen pick en un partido (usa service-role
 *  para leer los pick-holders, así no depende del RLS del cliente del cron). */
export async function sendPushToMatchPickers(
  matchId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number; skipped?: string }> {
  const sb = adminClient();
  if (!sb) return { sent: 0, removed: 0, skipped: "no-service-role" };
  const { data: picks } = await sb
    .from("match_predictions")
    .select("user_id")
    .eq("match_id", matchId);
  const userIds = [...new Set((picks ?? []).map((p) => p.user_id))];
  return sendPushToUsers(userIds, payload);
}

export interface GoalCandidate {
  matchId: string;
  homeCode: string;
  awayCode: string;
  newHome: number;
  newAway: number;
}

/** Compara el score nuevo (de ESPN) contra el actual en la DB y devuelve los
 *  partidos donde subió el total de goles. OJO: hay que llamarla ANTES de
 *  aplicar el update (si no, la DB ya tiene el score nuevo y no detecta nada). */
export async function detectGoals(
  cands: GoalCandidate[],
): Promise<GoalCandidate[]> {
  if (cands.length === 0) return [];
  const sb = adminClient();
  if (!sb) return [];
  const ids = cands.map((c) => c.matchId);
  const { data } = await sb
    .from("matches")
    .select("id, score_home, score_away")
    .in("id", ids);
  const prevTotal = new Map<string, number>();
  for (const r of data ?? []) {
    prevTotal.set(r.id, (r.score_home ?? 0) + (r.score_away ?? 0));
  }
  return cands.filter((c) => {
    const prev = prevTotal.get(c.matchId);
    if (prev === undefined) return false;
    return c.newHome + c.newAway > prev;
  });
}

/** Avisa de los goles a los pick-holders de cada partido. Best-effort. */
export async function sendGoalPushes(goals: GoalCandidate[]): Promise<void> {
  for (const g of goals) {
    await sendPushToMatchPickers(g.matchId, {
      title: "⚽ ¡Gol!",
      body: `${g.homeCode} ${g.newHome}-${g.newAway} ${g.awayCode} · tenés pick acá 👀`,
      url: `/matches/${g.matchId}`,
      tag: `gol-${g.matchId}`,
    });
  }
}
