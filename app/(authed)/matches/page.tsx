import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { MatchCard } from "@/components/match-card";
import {
  groupMatchesByDay,
  matchSelect,
  type MatchWithPick,
  type MatchWithRelations,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select(matchSelect)
    .order("kickoff_at", { ascending: true })
    .order("match_number", { ascending: true })
    .returns<MatchWithRelations[]>();

  if (matchesError) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-bold mb-2">No pude leer los partidos</h1>
        <pre className="text-xs text-red-500">{matchesError.message}</pre>
      </div>
    );
  }

  const matches = matchesData ?? [];

  const { data: picksData } = await supabase
    .from("match_predictions")
    .select(
      "id, match_id, predicted_winner, predicted_home, predicted_away, predicted_ko_winner_team_id, is_auto_random, state",
    )
    .eq("user_id", userId);

  const picksByMatch = new Map<string, MatchWithPick["user_pick"]>();
  for (const pick of picksData ?? []) {
    picksByMatch.set(pick.match_id, pick);
  }

  const matchesWithPicks: MatchWithPick[] = matches.map((m) => ({
    ...m,
    user_pick: picksByMatch.get(m.id) ?? null,
  }));

  const days = groupMatchesByDay(matchesWithPicks);

  const totalPicks = picksByMatch.size;
  const lockableMatches = matchesWithPicks.filter(
    (m) =>
      m.status === "scheduled" &&
      new Date(m.lock_at).getTime() > Date.now() &&
      m.home_team_id !== null,
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Partidos</h1>
        <p className="text-sm text-muted-foreground">
          {totalPicks} pick{totalPicks === 1 ? "" : "s"} cargado
          {totalPicks === 1 ? "" : "s"} · {lockableMatches.length} partido
          {lockableMatches.length === 1 ? "" : "s"} aún abierto
          {lockableMatches.length === 1 ? "" : "s"}.
        </p>
      </header>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay partidos cargados.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((day) => (
            <section key={day.dayKey} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {day.dayLabel}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {day.matches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
