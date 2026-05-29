"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult = { ok: true } | { ok: false; error: string };

function clampScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 20) return null;
  return i;
}

export async function submitPick(
  matchId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const home = clampScore(formData.get("home"));
  const away = clampScore(formData.get("away"));
  if (home === null || away === null) {
    return { ok: false, error: "El score debe ser un entero entre 0 y 20." };
  }
  const winner = home > away ? "home" : home < away ? "away" : "draw";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, status, lock_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr || !match) {
    return { ok: false, error: "No encontré el partido." };
  }
  if (match.status === "pending_bracket") {
    return { ok: false, error: "Todavía se está definiendo el cruce." };
  }
  if (new Date(match.lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "Ya cerró el deadline de este partido." };
  }

  const payload = {
    user_id: userId,
    match_id: matchId,
    predicted_winner: winner,
    predicted_home: home,
    predicted_away: away,
    is_auto_random: false,
    state: "open",
  } satisfies Parameters<typeof supabase.from>[0] extends never
    ? never
    : Record<string, unknown>;

  const { error: upsertErr } = await supabase
    .from("match_predictions")
    .upsert(payload, { onConflict: "user_id,match_id" });

  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
  revalidatePath("/mi-prode");
  return { ok: true };
}
