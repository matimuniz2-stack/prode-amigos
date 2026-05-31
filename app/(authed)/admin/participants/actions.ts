"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_TAGS } from "@/lib/tags";

type Result = { ok: true } | { ok: false; error: string };

type Client = Awaited<ReturnType<typeof createClient>>;

/** Verifica en el SERVER que quien llama es admin/owner. Las server actions no
 *  están protegidas por el guard del layout (se pueden invocar directo), así
 *  que validamos acá además de la RLS (defensa en capas). */
async function callerIsAdmin(supabase: Client): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();
  return data?.role === "admin" || data?.role === "owner";
}

/** El admin corrige el apodo de cualquier participante (RLS profiles_admin_all). */
export async function adminUpdateNickname(
  userId: string,
  nickname: string,
): Promise<Result> {
  const clean = nickname.trim();
  if (clean.length < 2 || clean.length > 24) {
    return { ok: false, error: "El apodo va de 2 a 24 letras." };
  }

  const supabase = await createClient();
  if (!(await callerIsAdmin(supabase))) {
    return { ok: false, error: "No tenés permisos." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: clean })
    .eq("id", userId);

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "Ese apodo ya está tomado." };
    }
    if (m.includes("row-level")) {
      return { ok: false, error: "No tenés permisos." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/participants");
  revalidatePath("/leaderboard");
  return { ok: true };
}

/** El admin define las etiquetas (logros) de un participante. Reemplaza el set
 *  completo. Los players no pueden tocarlas (RLS profiles_admin_all). */
export async function adminUpdateTags(
  userId: string,
  tags: string[],
): Promise<Result> {
  // Normalizamos: sin vacíos, sin duplicados, recortadas, con tope.
  const clean = Array.from(
    new Set(tags.map((t) => t.trim()).filter(Boolean)),
  );
  if (clean.length > MAX_TAGS) {
    return { ok: false, error: `Máximo ${MAX_TAGS} etiquetas por jugador.` };
  }
  if (clean.some((t) => t.length > 24)) {
    return { ok: false, error: "Cada etiqueta va hasta 24 caracteres." };
  }

  const supabase = await createClient();
  if (!(await callerIsAdmin(supabase))) {
    return { ok: false, error: "No tenés permisos." };
  }
  // tags aún no está en los tipos generados (migración 0017 aplicada en prod,
  // tipos sin regenerar) → cast as never, consistente con el resto del código.
  const { error } = await supabase
    .from("profiles")
    .update({ tags: clean } as never)
    .eq("id", userId);

  if (error) {
    if (error.message.toLowerCase().includes("row-level")) {
      return { ok: false, error: "No tenés permisos." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/participants");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}
