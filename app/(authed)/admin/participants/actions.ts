"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

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
