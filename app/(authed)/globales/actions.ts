"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface GlobalsInput {
  champion: string;
  runner_up: string;
  top_scorer_team: string;
  top_scorer_name: string;
  mvp_team: string;
  mvp_name: string;
  revelation_team: string;
  revelation_name: string;
}

type Result = { ok: true } | { ok: false; error: string };

export async function submitGlobals(input: GlobalsInput): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { ok: false, error: "Sesión vencida, recargá la página." };
  }
  const userId = claims.claims.sub as string;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, globals_lock_at")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return { ok: false, error: "No hay torneo configurado." };
  }
  if (new Date(tournament.globals_lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "El cierre de globales ya pasó." };
  }

  const rows: {
    user_id: string;
    tournament_id: string;
    category: string;
    team_id: string | null;
    player_team_id: string | null;
    player_name: string | null;
  }[] = [];

  if (input.champion) {
    rows.push({
      user_id: userId,
      tournament_id: tournament.id,
      category: "champion",
      team_id: input.champion,
      player_team_id: null,
      player_name: null,
    });
  }
  if (input.runner_up) {
    rows.push({
      user_id: userId,
      tournament_id: tournament.id,
      category: "runner_up",
      team_id: input.runner_up,
      player_team_id: null,
      player_name: null,
    });
  }

  const players: [string, string, string][] = [
    ["top_scorer", input.top_scorer_team, input.top_scorer_name],
    ["mvp", input.mvp_team, input.mvp_name],
    ["revelation", input.revelation_team, input.revelation_name],
  ];
  for (const [category, team, name] of players) {
    if (team && name.trim()) {
      rows.push({
        user_id: userId,
        tournament_id: tournament.id,
        category,
        team_id: null,
        player_team_id: team,
        player_name: name.trim(),
      });
    }
  }

  // Categorías que el usuario dejó vacías → se borran (des-apostar), así no
  // queda la apuesta vieja fantasma.
  const ALL_CATS = ["champion", "runner_up", "top_scorer", "mvp", "revelation"];
  const filledCats = rows.map((r) => r.category);
  const emptyCats = ALL_CATS.filter((c) => !filledCats.includes(c));

  if (emptyCats.length > 0) {
    const { error: delErr } = await supabase
      .from("global_predictions")
      .delete()
      .eq("user_id", userId)
      .eq("tournament_id", tournament.id)
      .in("category", emptyCats);
    if (delErr) {
      return { ok: false, error: delErr.message };
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("global_predictions")
      .upsert(rows, { onConflict: "user_id,tournament_id,category" });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("row-level") ||
        msg.includes("policy") ||
        msg.includes("violates")
      ) {
        return {
          ok: false,
          error: "El cierre de globales ya pasó o falta completar algún campo.",
        };
      }
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/globales");
  return { ok: true };
}
