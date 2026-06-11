import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import { MatchRow } from "@/components/match-row";
import { LiveRefresher } from "@/components/live-refresher";
import { StatCard } from "@/components/home/stat-card";
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
        <h1 className="mb-2 text-2xl font-bold text-cream">
          No pude leer los partidos
        </h1>
        <pre className="text-xs text-cardred">{matchesError.message}</pre>
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
  const hasLive = matchesWithPicks.some(
    (m) => displayStatus(m, now) === "live",
  );

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresher enabled={hasLive} />
      <header className="flex flex-col gap-4 pt-1">
        <h1 className="text-display text-3xl text-cream">Partidos</h1>
        <div className="grid grid-cols-3 gap-2">
          <StatCard emoji="✅" label="Hechos">
            <span className="text-2xl text-grass">{counters.done}</span>
          </StatCard>
          <StatCard emoji="🕒" label="Pendientes">
            <span
              className={cn(
                "text-2xl",
                counters.pending > 0 ? "text-cardred" : "text-ink/40",
              )}
            >
              {counters.pending}
            </span>
          </StatCard>
          <StatCard emoji="🔒" label="Cerrados">
            <span className="text-2xl text-ink/40">{counters.closed}</span>
          </StatCard>
        </div>
        {counters.pendingBracket > 0 && (
          <p className="text-xs text-cream/60">
            {counters.pendingBracket} partido
            {counters.pendingBracket === 1 ? "" : "s"} de eliminación con cruce
            pendiente — se habilitan cuando se resuelva la ronda anterior.
          </p>
        )}
      </header>

      {days.length === 0 ? (
        <p className="text-sm text-cream/70">
          Todavía no hay partidos cargados.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.dayKey} className="flex flex-col gap-2.5">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-cream/70">
                {day.dayLabel}
              </h2>
              <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:items-start">
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
