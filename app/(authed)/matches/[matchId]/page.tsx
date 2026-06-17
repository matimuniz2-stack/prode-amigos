import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { PickForm } from "@/components/pick-form";
import { LiveRefresher } from "@/components/live-refresher";
import {
  MatchOthersPicks,
  type MatchPickEntry,
} from "@/components/match-others-picks";
import { MatchGrieta } from "@/components/match-grieta";
import { MatchChat, type ChatMessage } from "@/components/match-chat";
import { PlenoCelebration } from "@/components/match/pleno-celebration";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import {
  scorePrediction,
  type PredictionInput,
  type ScoringRule,
} from "@/lib/scoring";
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
      "id, predicted_winner, predicted_home, predicted_away, predicted_ko_winner_team_id, is_auto_random, state, updated_at",
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
  // Cerrado pero sin terminar = en juego (o esperando que arranque la pelota).
  const isLive = isLocked && !isFinished && !isVoid;
  const hasScore = match.score_home !== null && match.score_away !== null;

  const stageLabel = match.stage
    ? (stageLabels[match.stage.code] ?? match.stage.code)
    : "";

  // Una vez cerrado el partido se revelan los picks de todos (la RLS ya
  // permite leer los ajenos sólo cuando lock_at <= now()).
  const stageCode = match.stage?.code ?? "group";
  const projectLive = isLive && hasScore;
  let otherPicks: MatchPickEntry[] = [];
  let myProjected: number | null = null;
  let chatMessages: ChatMessage[] = [];
  let myMatchPoints: number | null = null;
  if (isLocked) {
    const [{ data: allPicks }, { data: matchPoints }, { data: ruleRows }] =
      await Promise.all([
        supabase
          .from("match_predictions")
          .select(
            "user_id, predicted_winner, predicted_home, predicted_away, predicted_ko_winner_team_id, is_auto_random",
          )
          .eq("match_id", match.id),
        supabase
          .from("points_log")
          .select("user_id, points")
          .eq("source_kind", "match")
          .eq("source_id", match.id),
        projectLive
          ? supabase
              .from("scoring_rules")
              .select("rule_key, scope_stage, points")
              .eq("tournament_id", match.tournament_id)
              .is("active_to", null)
          : Promise.resolve({ data: [] as ScoringRule[] }),
      ]);

    const rules = (ruleRows ?? []) as ScoringRule[];

    const ids = [...new Set((allPicks ?? []).map((p) => p.user_id))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, nickname, avatar_url").in("id", ids)
      : { data: [] as { id: string; nickname: string; avatar_url: string | null }[] };

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
    const avatarById = new Map(
      (profiles ?? []).map((p) => [p.id, p.avatar_url]),
    );
    const pointsById = new Map(
      (matchPoints ?? []).map((r) => [r.user_id, r.points]),
    );
    myMatchPoints = isFinished ? (pointsById.get(userId) ?? null) : null;
    const teamNameById = new Map(
      [match.home_team, match.away_team]
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .map((t) => [t.id, t.name]),
    );

    // Puntos: si terminó, los reales (points_log); si está en juego, los
    // proyectados sobre el marcador actual.
    const pointsFor = (p: { user_id: string } & PredictionInput): number | null => {
      if (isFinished) return pointsById.get(p.user_id) ?? null;
      if (projectLive) {
        return scorePrediction(
          p,
          match.score_home as number,
          match.score_away as number,
          stageCode,
          rules,
        ).points;
      }
      return null;
    };

    otherPicks = (allPicks ?? [])
      .map((p) => {
        const points = pointsFor(p);
        if (p.user_id === userId) myProjected = projectLive ? points : null;
        return {
          userId: p.user_id,
          nickname: nameById.get(p.user_id) ?? "Jugador",
          predictedHome: p.predicted_home,
          predictedAway: p.predicted_away,
          isAutoRandom: p.is_auto_random,
          koWinnerName: p.predicted_ko_winner_team_id
            ? (teamNameById.get(p.predicted_ko_winner_team_id) ?? null)
            : null,
          points,
          isSelf: p.user_id === userId,
          avatarUrl: avatarById.get(p.user_id) ?? null,
        };
      })
      .sort((a, b) => {
        if (isFinished || projectLive) {
          const pb = b.points ?? -1;
          const pa = a.points ?? -1;
          if (pb !== pa) return pb - pa;
        } else if (a.isSelf !== b.isSelf) {
          return a.isSelf ? -1 : 1;
        }
        return a.nickname.localeCompare(b.nickname, "es");
      });

    // Reacciones con emoji a cada pick (chicana post-lock).
    const { data: reactRows } = await supabase
      .from("pick_reactions")
      .select("target_user_id, emoji, reactor_user_id")
      .eq("match_id", match.id);
    const reByUser = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const r of reactRows ?? []) {
      const m = reByUser.get(r.target_user_id) ?? new Map();
      const cur = m.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.reactor_user_id === userId) cur.mine = true;
      m.set(r.emoji, cur);
      reByUser.set(r.target_user_id, m);
    }
    otherPicks = otherPicks.map((e) => ({
      ...e,
      reactions: [...(reByUser.get(e.userId)?.entries() ?? [])].map(
        ([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }),
      ),
    }));

    // Chat del partido (post-lock).
    const { data: chatRows } = await supabase
      .from("match_chat_messages")
      .select("id, content, created_at, user_id")
      .eq("match_id", match.id)
      .order("created_at", { ascending: true });
    const missing = [
      ...new Set((chatRows ?? []).map((m) => m.user_id)),
    ].filter((uid) => !nameById.has(uid));
    if (missing.length > 0) {
      const { data: extra } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", missing);
      for (const p of extra ?? []) {
        nameById.set(p.id, p.nickname);
        avatarById.set(p.id, p.avatar_url);
      }
    }
    chatMessages = (chatRows ?? []).map((m) => ({
      id: m.id,
      nickname: nameById.get(m.user_id) ?? "Jugador",
      content: m.content,
      time: matchTimeLabel(m.created_at),
      isSelf: m.user_id === userId,
      avatarUrl: avatarById.get(m.user_id) ?? null,
    }));
  }

  const isPleno =
    isFinished &&
    hasScore &&
    pick !== null &&
    pick.predicted_home === match.score_home &&
    pick.predicted_away === match.score_away;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
      <LiveRefresher enabled={isLive} />
      {isPleno && (myMatchPoints ?? 0) > 0 && (
        <PlenoCelebration
          matchId={match.id}
          points={myMatchPoints ?? 0}
          scoreLabel={`${match.score_home}-${match.score_away}`}
        />
      )}
      <Link
        href="/matches"
        className="text-xs font-semibold text-cream/70 hover:text-cream"
      >
        ← Volver a partidos
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display text-2xl leading-tight text-cream">
            {match.home_team?.name ?? match.home_placeholder ?? "TBD"}{" "}
            <span className="text-gold">vs</span>{" "}
            {match.away_team?.name ?? match.away_placeholder ?? "TBD"}
          </h1>
          {(isFinished || isLive) && (
            <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-cream px-3 py-1.5 text-ink shadow-card ring-1 ring-black/5">
              <span className="text-xl font-black leading-none tabular-nums">
                {hasScore
                  ? `${match.score_home} - ${match.score_away}`
                  : "—"}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  isFinished ? "text-ink/50" : "text-cardred",
                )}
              >
                {isFinished ? "Final" : "En vivo"}
              </span>
            </div>
          )}
        </div>
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
              {projectLive && pick && myProjected !== null && (
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-bold",
                    myProjected > 0
                      ? "bg-grass/15 text-grass ring-1 ring-grass/30"
                      : "bg-ink/5 text-ink/60",
                  )}
                >
                  {myProjected > 0
                    ? `🟢 Si termina así, sumás +${myProjected} pts`
                    : "⚪ Si termina así, no sumás puntos"}
                </div>
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

              <div className="mt-2 flex flex-col gap-3 border-t border-black/5 pt-4">
                <h3 className="text-sm font-extrabold">
                  Lo que pusieron los demás
                  {projectLive && (
                    <span className="ml-1 font-medium text-ink/45">
                      · puntos proyectados (~)
                    </span>
                  )}
                </h3>
                {otherPicks.length > 0 && (
                  <MatchGrieta
                    entries={otherPicks}
                    homeLabel={
                      match.home_team?.name ?? match.home_placeholder ?? "Local"
                    }
                    awayLabel={
                      match.away_team?.name ?? match.away_placeholder ?? "Visita"
                    }
                  />
                )}
                <MatchOthersPicks
                  entries={otherPicks}
                  finished={isFinished}
                  live={projectLive}
                  matchId={match.id}
                />
              </div>

              <MatchChat matchId={match.id} messages={chatMessages} />
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
                  homeCode={match.home_team.code}
                  awayCode={match.away_team.code}
                  initialHome={pick?.predicted_home ?? 0}
                  initialAway={pick?.predicted_away ?? 0}
                  hasPick={pick !== null}
                  isAutoRandom={pick?.is_auto_random ?? false}
                  isKO={match.stage?.code !== "group"}
                  homeTeamId={match.home_team.id}
                  awayTeamId={match.away_team.id}
                  initialKoWinner={pick?.predicted_ko_winner_team_id ?? null}
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
