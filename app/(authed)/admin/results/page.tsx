import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  groupMatchesByDay,
  matchSelect,
  matchTimeLabel,
  stageLabels,
  type MatchWithRelations,
} from "@/lib/matches";
import { SectionHeading } from "@/components/home/section-heading";
import { AdminResultRow } from "@/components/admin/result-row";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const supabase = await createClient();

  const { data: matchesData } = await supabase
    .from("matches")
    .select(matchSelect)
    .order("kickoff_at", { ascending: true })
    .order("match_number", { ascending: true })
    .returns<MatchWithRelations[]>();

  // Solo partidos con equipos definidos (los pending_bracket se cargan
  // recién cuando se resuelve el cruce).
  const playable = (matchesData ?? []).filter(
    (m) => m.home_team && m.away_team,
  );
  const days = groupMatchesByDay(playable);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Resultados</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-cream/70">
          No hay partidos con equipos definidos todavía.
        </p>
      ) : (
        days.map((day) => (
          <section key={day.dayKey} className="flex flex-col gap-2.5">
            <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-cream/70">
              {day.dayLabel}
            </h2>
            {day.matches.map((m) => {
              const stage =
                m.stage?.code === "group" && m.group?.code
                  ? `Grupo ${m.group.code}`
                  : (m.stage && stageLabels[m.stage.code]) ?? "Partido";
              return (
                <AdminResultRow
                  key={m.id}
                  matchId={m.id}
                  meta={`${stage} · ${matchTimeLabel(m.kickoff_at)}`}
                  homeName={m.home_team!.name}
                  awayName={m.away_team!.name}
                  homeFlag={m.home_team!.flag_emoji}
                  awayFlag={m.away_team!.flag_emoji}
                  homeTeamId={m.home_team!.id}
                  awayTeamId={m.away_team!.id}
                  isKO={m.stage?.code !== "group"}
                  initialHome={m.score_home}
                  initialAway={m.score_away}
                  initialKoWinner={m.ko_winner_team_id}
                  finished={m.status === "finished"}
                />
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
