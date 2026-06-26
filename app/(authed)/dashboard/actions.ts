"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

type DeclarationKind = "text" | "audio" | "photo";

/**
 * Conferencia de prensa: guardar/editar tu declaración de la fecha (day_key).
 * Puede ser texto, audio (nota de voz) o foto. Para audio/foto el cliente sube
 * el archivo al bucket 'declarations' y manda acá la URL pública + el texto
 * opcional (caption).
 */
export async function postDeclaration(
  dayKey: string,
  text: string,
  kind: DeclarationKind = "text",
  mediaUrl: string | null = null,
): Promise<Result> {
  const clean = text.trim();
  if (!dayKey) return { ok: false, error: "Fecha inválida." };
  if (!["text", "audio", "photo"].includes(kind)) {
    return { ok: false, error: "Tipo de declaración inválido." };
  }
  if (kind === "text") {
    if (clean.length < 1) return { ok: false, error: "Escribí algo." };
  } else if (!mediaUrl) {
    return { ok: false, error: "Falta el archivo." };
  }
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
      {
        user_id: userId,
        day_key: dayKey,
        text: clean.length > 0 ? clean : null,
        kind,
        media_url: kind === "text" ? null : mediaUrl,
      },
      { onConflict: "user_id,day_key" },
    );
  if (error) {
    const m = error.message.toLowerCase();
    if (
      error.code === "PGRST205" ||
      m.includes("schema cache") ||
      m.includes("does not exist") ||
      m.includes("relation")
    ) {
      return {
        ok: false,
        error:
          "Todavía no está lista la tabla de declaraciones (falta la migración en Supabase). Avisale al admin.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
