"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
