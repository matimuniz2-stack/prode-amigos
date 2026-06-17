"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeAutoBadges } from "@/lib/badges";

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
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", claims.claims.sub as string);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mi-prode");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}
