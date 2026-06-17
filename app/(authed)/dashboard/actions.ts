"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Conferencia de prensa: guardar/editar tu declaración de la fecha (day_key). */
export async function postDeclaration(
  dayKey: string,
  text: string,
): Promise<Result> {
  const clean = text.trim();
  if (!dayKey) return { ok: false, error: "Fecha inválida." };
  if (clean.length < 1) return { ok: false, error: "Escribí algo." };
  if (clean.length > 240) return { ok: false, error: "Máximo 240 caracteres." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;

  const { error } = await supabase
    .from("declarations")
    .upsert(
      { user_id: userId, day_key: dayKey, text: clean },
      { onConflict: "user_id,day_key" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
