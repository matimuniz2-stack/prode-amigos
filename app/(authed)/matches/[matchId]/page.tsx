import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  const stageLabel = match.stage ? (stageLabels[match.stage.code] ?? match.stage.code) : "";

  return (
    <div className="flex flex-col gap-6 py-6 max-w-xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <Link
          href="/matches"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Volver a partidos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {match.home_team?.name ?? match.home_placeholder ?? "TBD"}{" "}
          <span className="text-muted-foreground">vs</span>{" "}
          {match.away_team?.name ?? match.away_placeholder ?? "TBD"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {stageLabel}
          {match.group?.code ? ` · Grupo ${match.group.code}` : ""} · Partido #
          {match.match_number}
        </p>
        <p className="text-sm">
          {matchDayLabel(match.kickoff_at)} · {matchTimeLabel(match.kickoff_at)} ARG
        </p>
      </header>

      {isPending && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no se definieron los equipos. Cuando termine la fase previa
            vas a poder cargar tu pick acá.
          </p>
        </div>
      )}

      {isVoid && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Este partido fue anulado.
          </p>
        </div>
      )}

      {!isPending && !isVoid && (
        <section className="border rounded-lg p-5">
          {isLocked ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold">Picks cerrados</h2>
              {pick ? (
                <div className="text-sm">
                  Tu pick:{" "}
                  <span className="font-bold tabular-nums">
                    {pick.predicted_home} - {pick.predicted_away}
                  </span>
                  {pick.is_auto_random && (
                    <span className="ml-2 text-muted-foreground">
                      (🎲 auto-random, no llegaste a tiempo)
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No cargaste pick antes del cierre.
                </p>
              )}
              {isFinished &&
                match.score_home !== null &&
                match.score_away !== null && (
                  <p className="text-sm">
                    Resultado final:{" "}
                    <span className="font-bold tabular-nums">
                      {match.score_home} - {match.score_away}
                    </span>
                  </p>
                )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {pick ? "Editar tu pick" : "Cargar tu pick"}
                </h2>
                <span className="text-xs text-muted-foreground">
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

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/matches">Ver todos los partidos</Link>
        </Button>
      </div>
    </div>
  );
}
