import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { PickForm } from "@/components/pick-form";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import {
  matchDayLabel,
  matchSelect,
  matchTimeLabel,
  stageLabels,
  type MatchWithRelations,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const { matchId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: match } = await supabase
    .from("matches")
    .select(matchSelect)
    .eq("id", matchId)
    .maybeSingle<MatchWithRelations>();

  if (!match) {
    notFound();
  }

  const { data: pick } = await supabase
    .from("match_predictions")
    .select(
      "id, predicted_winner, predicted_home, predicted_away, is_auto_random, state, updated_at",
    )
    .eq("user_id", userId)
    .eq("match_id", match.id)
    .maybeSingle();

  const lockMs = new Date(match.lock_at).getTime();
  const now = Date.now();
  const isPending = match.status === "pending_bracket";
  const isVoid = match.status === "cancelled" || match.status === "void";
  const isLocked = !isPending && lockMs <= now;
  const isFinished = match.status === "finished";

  const stageLabel = match.stage
    ? (stageLabels[match.stage.code] ?? match.stage.code)
    : "";

  return (
    <div className="flex flex-col gap-6 pt-1">
      <Link
        href="/matches"
        className="text-xs font-semibold text-cream/70 hover:text-cream"
      >
        ← Volver a partidos
      </Link>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-display text-2xl leading-tight text-cream">
          {match.home_team?.name ?? match.home_placeholder ?? "TBD"}{" "}
          <span className="text-gold">vs</span>{" "}
          {match.away_team?.name ?? match.away_placeholder ?? "TBD"}
        </h1>
        <p className="text-sm text-cream/60">
          {stageLabel}
          {match.group?.code ? ` · Grupo ${match.group.code}` : ""} · Partido #
          {match.match_number}
        </p>
        <p className="text-sm text-cream/85">
          {matchDayLabel(match.kickoff_at)} · {matchTimeLabel(match.kickoff_at)}{" "}
          ARG
        </p>
      </header>

      {isPending && (
        <div className="rounded-2xl border-2 border-dashed border-cream/20 p-6 text-center text-sm text-cream/70">
          Todavía no se definieron los equipos. Cuando termine la fase previa vas
          a poder cargar tu pick acá.
        </div>
      )}

      {isVoid && (
        <div className="rounded-2xl border-2 border-dashed border-cream/20 p-6 text-center text-sm text-cream/70">
          Este partido fue anulado.
        </div>
      )}

      {!isPending && !isVoid && (
        <section className="rounded-2xl bg-cream p-5 text-ink shadow-card ring-1 ring-black/5">
          {isLocked ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-extrabold">Picks cerrados</h2>
              {pick ? (
                <p className="text-sm">
                  Tu pick:{" "}
                  <span className="font-black tabular-nums">
                    {pick.predicted_home} - {pick.predicted_away}
                  </span>
                  {pick.is_auto_random && (
                    <span className="text-ink/55">
                      {" "}
                      (🎲 auto-random, no llegaste a tiempo)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-ink/60">
                  No cargaste pick antes del cierre.
                </p>
              )}
              {isFinished &&
                match.score_home !== null &&
                match.score_away !== null && (
                  <p className="text-sm">
                    Resultado final:{" "}
                    <span className="font-black tabular-nums">
                      {match.score_home} - {match.score_away}
                    </span>
                  </p>
                )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-extrabold">
                  {pick ? "Editar tu pick" : "Cargar tu pick"}
                </h2>
                <span className="text-xs text-ink/55">
                  Cierra en <Countdown target={match.lock_at} />
                </span>
              </div>
              {match.home_team && match.away_team && (
                <PickForm
                  matchId={match.id}
                  lockAt={match.lock_at}
                  homeTeamName={match.home_team.name}
                  awayTeamName={match.away_team.name}
                  homeFlag={match.home_team.flag_emoji}
                  awayFlag={match.away_team.flag_emoji}
                  initialHome={pick?.predicted_home ?? 0}
                  initialAway={pick?.predicted_away ?? 0}
                  hasPick={pick !== null}
                  isAutoRandom={pick?.is_auto_random ?? false}
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
