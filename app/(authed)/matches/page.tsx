import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { MatchRow } from "@/components/match-row";
import {
  displayStatus,
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

  const now = Date.now();
  const counters = { done: 0, pending: 0, closed: 0, pendingBracket: 0 };
  for (const m of matchesWithPicks) {
    const s = displayStatus(m, now);
    if (s === "pending_bracket") {
      counters.pendingBracket += 1;
      continue;
    }
    if (s === "void") continue;
    if (m.user_pick) counters.done += 1;
    else if (s === "upcoming" || s === "locking_soon") counters.pending += 1;
    else counters.closed += 1;
  }

  const days = groupMatchesByDay(matchesWithPicks);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Partidos</h1>
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {counters.done}
            </div>
            <div className="text-xs text-muted-foreground">hechos</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div
              className={`text-2xl font-bold tabular-nums ${
                counters.pending > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}
            >
              {counters.pending}
            </div>
            <div className="text-xs text-muted-foreground">pendientes</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold tabular-nums text-muted-foreground">
              {counters.closed}
            </div>
            <div className="text-xs text-muted-foreground">cerrados</div>
          </div>
        </div>
        {counters.pendingBracket > 0 && (
          <p className="text-xs text-muted-foreground">
            {counters.pendingBracket} partido
            {counters.pendingBracket === 1 ? "" : "s"} de eliminación con cruce
            pendiente — se habilitan cuando se resuelva la ronda anterior.
          </p>
        )}
      </header>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay partidos cargados.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.dayKey} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {day.dayLabel}
              </h2>
              <div className="flex flex-col gap-2">
                {day.matches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
