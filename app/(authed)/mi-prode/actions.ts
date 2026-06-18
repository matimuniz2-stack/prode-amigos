"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeAutoBadges } from "@/lib/badges";
import { sendPushToUsers } from "@/lib/push";

type Result = { ok: true } | { ok: false; error: string };

export async function updateNickname(nickname: string): Promise<Result> {
  const clean = nickname.trim();
  if (clean.length < 2 || clean.length > 24) {
    return { ok: false, error: "El apodo tiene que tener entre 2 y 24 letras." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname: clean })
    .eq("id", claims.claims.sub as string);

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "Ese apodo ya está tomado, probá otro." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/mi-prode");
  revalidatePath("/leaderboard");
  return { ok: true };
}

/** Insignia destacada: el tag que chapeás al lado del nombre. null = sacarla.
 *  Solo se puede destacar una insignia que el usuario realmente tiene. */
export async function setFeaturedTag(tag: string | null): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;

  let valid: string | null = null;
  if (tag) {
    const [{ data: prof }, autoBadges] = await Promise.all([
      supabase
        .from("profiles")
        .select("tags")
        .eq("id", userId)
        .maybeSingle<{ tags: string[] | null }>(),
      computeAutoBadges(supabase),
    ]);
    const owned = new Set([
      ...(prof?.tags ?? []),
      ...(autoBadges.get(userId) ?? []),
    ]);
    if (!owned.has(tag)) {
      return { ok: false, error: "Esa insignia no es tuya." };
    }
    valid = tag;
  }

  // featured_tag no está en los tipos generados (desactualizados) → cast.
  const { error } = await supabase
    .from("profiles")
    .update({ featured_tag: valid } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mi-prode");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Guarda (o refresca) la suscripción de push de ESTE dispositivo. */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<Result> {
  const endpoint = sub?.endpoint?.trim() ?? "";
  if (!endpoint || !sub?.p256dh || !sub?.auth) {
    return { ok: false, error: "Suscripción incompleta." };
  }
  // Formato esperado de Web Push (evita basura/abuso). El endpoint es una URL
  // https del push service; las claves son base64url cortas.
  if (
    endpoint.length > 1000 ||
    !/^https:\/\//.test(endpoint) ||
    sub.p256dh.length > 200 ||
    sub.auth.length > 200
  ) {
    return { ok: false, error: "Suscripción inválida." };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;

  // Tope de dispositivos por usuario (backstop anti-abuso; nadie real llega).
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= 20) {
    return { ok: false, error: "Demasiados dispositivos registrados." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    const m = error.message.toLowerCase();
    if (
      error.code === "PGRST205" ||
      m.includes("does not exist") ||
      m.includes("schema cache")
    ) {
      return { ok: false, error: "Faltan las notis del lado del server (avisale al admin)." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Borra la suscripción de este dispositivo (al desactivar las notis). */
export async function removePushSubscription(endpoint: string): Promise<Result> {
  if (!endpoint) return { ok: true };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", claims.claims.sub as string);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Manda un push de prueba al propio usuario (para verificar que llega). */
export async function sendTestPush(): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;
  const res = await sendPushToUsers([userId], {
    title: "🔔 ¡Funciona!",
    body: "Tenés las notis del Prode activadas. Acá te van a llegar los avisos.",
    url: "/mi-prode",
    tag: "test",
  });
  if (res.sent === 0) {
    if (res.skipped) {
      return { ok: false, error: "Falta terminar de configurar el server." };
    }
    return { ok: false, error: "No se pudo enviar (revisá el permiso del navegador)." };
  }
  return { ok: true };
}

/** Setea la URL del avatar (la foto ya se subió al bucket desde el cliente). */
export async function setAvatarUrl(url: string): Promise<Result> {
  if (!url || url.length > 600 || !/^https?:\/\//.test(url)) {
    return { ok: false, error: "URL de imagen inválida." };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;
  // La foto tiene que vivir en NUESTRO bucket, en la carpeta del propio usuario
  // (evita setear una URL externa arbitraria).
  if (!url.includes(`/storage/v1/object/public/avatars/${userId}/`)) {
    return { ok: false, error: "La foto tiene que subirse desde el prode." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mi-prode");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}
