"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; awarded: number } | { ok: false; error: string };

const PLAYER_CATS = ["top_scorer", "mvp", "revelation"];

export async function resolveGlobalCategory(input: {
  category: string;
  teamId: string;
  playerName: string | null;
  reason: string;
}): Promise<Result> {
  if (!input.teamId) {
    return { ok: false, error: "Elegí el equipo." };
  }
  if (PLAYER_CATS.includes(input.category) && !input.playerName?.trim()) {
    return { ok: false, error: "Escribí el nombre del jugador." };
  }

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!tournament) return { ok: false, error: "No hay torneo." };

  const { data, error } = await supabase.rpc("resolve_global", {
    p_tournament_id: tournament.id,
    p_category: input.category,
    p_team_id: input.teamId,
    p_player_name: (input.playerName?.trim() || null) as string,
    p_reason: input.reason.trim() || "Resolución de global",
  });

  if (error) {
    const m = error.message.toLowerCase();
    return {
      ok: false,
      error: m.includes("autorizado") ? "No tenés permisos." : error.message,
    };
  }

  revalidatePath("/leaderboard");
  revalidatePath("/mi-prode");
  return { ok: true, awarded: (data as number) ?? 0 };
}
