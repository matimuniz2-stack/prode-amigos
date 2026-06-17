import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import {
  displayStatus,
  matchSelect,
  matchDayLabel,
  matchTimeLabel,
  relativeDayLabel,
  todayLabelAR,
  stageLabels,
  type MatchWithRelations,
} from "@/lib/matches";
import { computeAutoBadges, AUTO_BADGE_LABELS } from "@/lib/badges";
import { ArgentinaHype } from "@/components/home/argentina-hype";
import { PrimaryButton } from "@/components/home/primary-button";
import { StatCard } from "@/components/home/stat-card";
import { SectionHeading } from "@/components/home/section-heading";
import { MatchCard } from "@/components/home/match-card";
import { LiveRefresher } from "@/components/live-refresher";
import { Flag } from "@/components/flag";
import { Avatar } from "@/components/avatar";
import { RecapFecha } from "@/components/home/recap-fecha";
import { DiarioProde } from "@/components/home/diario-prode";
import { computeRecap } from "@/lib/recap";
import { buildDiario } from "@/lib/diario";
import { PreCierreReminder } from "@/components/home/pre-cierre-reminder";
import { CountUp } from "@/components/effects/count-up";
import { BadgeDrop } from "@/components/effects/badge-drop";
import { TagDeLaFecha } from "@/components/home/tag-de-la-fecha";

export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

function matchMeta(m: MatchWithRelations): string {
  const stage =
    m.stage?.code === "group" && m.group?.code
      ? `Grupo ${m.group.code}`
      : (m.stage && stageLabels[m.stage.code]) ?? "Partido";
  return `${stage} · ${matchTimeLabel(m.kickoff_at)}`;
}

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const now = Date.now();

  // Consultas independientes en paralelo (antes iban una atrás de otra).
  const [
    matchesRes,
    rankingRes,
    meRes,
    playerCountRes,
    globalsCountRes,
    autoBadges,
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(matchSelect)
      .order("kickoff_at", { ascending: true })
      .order("match_number", { ascending: true })
      .returns<MatchWithRelations[]>(),
    supabase
      .from("leaderboard_projection")
      .select("user_id, nickname, total_points, rank")
      .order("rank", { ascending: true }),
    supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("global_predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    computeAutoBadges(supabase),
  ]);

  const upcoming = (matchesRes.data ?? []).filter((m) => {
    const s = displayStatus(m, now);
    return (
      (s === "upcoming" || s === "locking_soon") && m.home_team && m.away_team
    );
  });

  const liveMatches = (matchesRes.data ?? []).filter(
    (m) => displayStatus(m, now) === "live" && m.home_team && m.away_team,
  );

  // Los picks dependen de qué partidos están "próximos" → va después.
  const picksByMatch = new Map<
    string,
    { predicted_home: number; predicted_away: number; is_auto_random: boolean }
  >();
  if (upcoming.length > 0) {
    const { data: picks } = await supabase
      .from("match_predictions")
      .select("match_id, predicted_home, predicted_away, is_auto_random")
      .eq("user_id", userId)
      .in(
        "match_id",
        upcoming.map((m) => m.id),
      );
    for (const p of picks ?? []) picksByMatch.set(p.match_id, p);
  }
  const nextMatches = upcoming.slice(0, 3);
  const nextMatch = upcoming[0] ?? null;
  const nextMatchLabel = nextMatch
    ? `${nextMatch.home_team?.name} vs ${nextMatch.away_team?.name}`
    : "Por definirse";

  // Recordatorio pre-cierre: cuántos picks faltan y cuándo cierra el próximo.
  const missingPicks = upcoming.filter((m) => !picksByMatch.has(m.id)).length;
  const nextLockAt = nextMatch?.lock_at ?? null;

  const standings = rankingRes.data ?? [];
  const hasScores = standings.some((r) => (r.total_points ?? 0) > 0);
  const me = meRes.data;
  const playerCount = playerCountRes.count;
  const globalsCount = globalsCountRes.count;

  const myRow = standings.find((r) => r.user_id === userId);
  const myPoints = myRow?.total_points ?? 0;
  const myRank = myRow?.rank ?? null;
  const myNick = me?.nickname ?? "vos";

  // Recap de la última fecha terminada (Fase 4).
  const recap = await computeRecap(supabase, matchesRes.data ?? []);

  // 📰 El Diario del Prode: crónica diaria para copiar al grupo. Junta la
  // tabla, el resumen de la última fecha, las insignias del momento y lo que
  // se viene. Reusa data ya cargada (standings, badges, próximos partidos).
  const nickByUser = new Map(
    standings.map((r) => [r.user_id, r.nickname ?? "—"]),
  );
  const badgeHas = (uid: string | null | undefined, label: string) =>
    Boolean(uid) && (autoBadges.get(uid as string) ?? []).includes(label);
  const nickWithBadge = (label: string): string | null => {
    for (const [uid, labels] of autoBadges) {
      if (labels.includes(label)) return nickByUser.get(uid) ?? null;
    }
    return null;
  };
  const nowDate = new Date(now);
  const nextLock = upcoming[0]?.lock_at ?? upcoming[0]?.kickoff_at ?? null;
  const diarioText = buildDiario({
    todayLabel: todayLabelAR(nowDate),
    recap,
    standings: standings.map((r) => ({
      nickname: r.nickname ?? "—",
      points: r.total_points ?? 0,
      rank: r.rank ?? 0,
      hot: badgeHas(r.user_id, AUTO_BADGE_LABELS.en_racha),
      cold: badgeHas(r.user_id, AUTO_BADGE_LABELS.pecho_frio),
    })),
    fixtures: upcoming.slice(0, 3).map((m) => ({
      label: `${m.home_team?.name} vs ${m.away_team?.name}`,
      whenLabel: `${relativeDayLabel(m.kickoff_at, nowDate)} ${matchTimeLabel(m.kickoff_at)}`,
    })),
    closesLabel: nextLock
      ? `${relativeDayLabel(nextLock, nowDate)} ${matchTimeLabel(nextLock)}`
      : null,
    extras: {
      francotirador: nickWithBadge(AUTO_BADGE_LABELS.francotirador),
      fantasma: nickWithBadge(AUTO_BADGE_LABELS.fantasma),
    },
  });

  // 🇦🇷 Hype de Argentina: si hay partido en vivo o próximo (≤36h).
  const ARG_WINDOW_MS = 36 * 60 * 60 * 1000;
  const argMatch = (matchesRes.data ?? [])
    .filter(
      (m) =>
        (m.home_team?.code === "ARG" || m.away_team?.code === "ARG") &&
        m.home_team &&
        m.away_team,
    )
    .map((m) => ({ m, s: displayStatus(m, now), k: new Date(m.kickoff_at).getTime() }))
    .filter(
      ({ s, k }) =>
        s === "live" ||
        s === "locking_soon" ||
        (s === "upcoming" && k > now && k - now <= ARG_WINDOW_MS),
    )
    .sort((a, b) => a.k - b.k)[0];

  let argHype: {
    opponentName: string;
    opponentFlag: string | null;
    whenLabel: string;
    live: boolean;
    href: string;
  } | null = null;
  if (argMatch) {
    const m = argMatch.m;
    const argIsHome = m.home_team?.code === "ARG";
    const opp = argIsHome ? m.away_team : m.home_team;
    const live = argMatch.s === "live";
    argHype = {
      opponentName: opp?.name ?? "Rival",
      opponentFlag: opp?.flag_emoji ?? null,
      whenLabel: `${matchDayLabel(m.kickoff_at)} · ${matchTimeLabel(m.kickoff_at)}`,
      live,
      href: live ? "/sala-en-vivo" : `/matches/${m.id}`,
    };
  }

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <LiveRefresher enabled={liveMatches.length > 0} />
      {nextLockAt && (
        <PreCierreReminder missingCount={missingPicks} nextLock={nextLockAt} />
      )}
      <BadgeDrop badges={autoBadges.get(userId) ?? []} />
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-1 text-center lg:items-start lg:text-left">
          <div className="flex items-end gap-2">
            <span aria-hidden className="mb-1 text-4xl leading-none">
              ⚽
            </span>
            <div className="text-display leading-[0.82]">
              <span className="block text-[2.4rem] text-cream text-shadow-pop">
                PRODE
              </span>
              <span className="block text-[2.4rem] text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
                DE LOS PIBES
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-cream/80">
            Predicciones, cargadas y gloria eterna.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row lg:shrink-0">
          <PrimaryButton href="/matches" className="lg:w-auto">
            ⚽ Hacer mis pronósticos
          </PrimaryButton>
          <div className="flex items-center gap-2 rounded-2xl bg-cream px-3 py-2 text-ink shadow-card ring-1 ring-black/5">
            <Avatar
              src={me?.avatar_url ?? null}
              name={myNick}
              className="size-12 text-base"
            />
            <div className="leading-tight">
              <div className="text-sm font-extrabold">{myNick}</div>
              <div className="text-xs font-bold text-pitch">⭐ {myPoints} pts</div>
            </div>
          </div>
        </div>
      </header>

      {/* 🇦🇷 Banner de Argentina (en vivo o próximo) */}
      {argHype && <ArgentinaHype {...argHype} />}

      {/* Main + Aside */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* MAIN */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard emoji="🏆" label="Puesto actual">
              {myRank ? (
                <>
                  Vas <span className="text-lg text-pitch">{myRank}°</span> de{" "}
                  {playerCount ?? 0}
                </>
              ) : (
                "Sin jugar aún"
              )}
            </StatCard>
            <StatCard emoji="⭐" label="Puntos">
              <span className="text-lg text-pitch">
                <CountUp value={myPoints} />
              </span>{" "}
              pts
            </StatCard>
            <StatCard emoji="⚽" label="Próximo partido">
              <span className="line-clamp-2">{nextMatchLabel}</span>
            </StatCard>
            <StatCard emoji="🕒" label="Por jugar">
              <span className="text-lg text-pitch">{upcoming.length}</span>{" "}
              partidos
            </StatCard>
          </div>

          {/* Recap de la última fecha + diario compartible (diario = todos los días) */}
          {recap && <RecapFecha recap={recap} />}
          {recap && <TagDeLaFecha recap={recap} />}
          {diarioText && <DiarioProde text={diarioText} />}

          {/* Acceso a globales */}
          <Link
            href="/globales"
            className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5 transition-transform active:scale-[0.99]"
          >
            <div className="flex flex-col">
              <span className="font-extrabold">🏆 Globales del Mundial</span>
              <span className="text-xs text-ink/60">
                Campeón, goleador, MVP y más
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-pitch/10 px-2.5 py-1 text-xs font-bold text-pitch">
              {globalsCount ?? 0}/5
            </span>
          </Link>

          {/* En vivo */}
          {liveMatches.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading>En vivo</SectionHeading>
              <div className="flex flex-col gap-3">
                {liveMatches.map((m) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="flex flex-col gap-1.5 rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between text-xs text-ink/50">
                      <span className="font-semibold uppercase tracking-wide">
                        {matchMeta(m)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cardred px-2.5 py-0.5 text-xs font-bold text-white">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" />
                        EN VIVO
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Flag
                          emoji={m.home_team?.flag_emoji ?? null}
                          code={m.home_team?.code ?? null}
                          name={m.home_team?.name ?? "TBD"}
                          className="h-6"
                        />
                        <span className="truncate font-bold">
                          {m.home_team?.name}
                        </span>
                      </div>
                      <span className="min-w-[3.5rem] text-center text-lg font-black tabular-nums">
                        {m.score_home ?? 0} - {m.score_away ?? 0}
                      </span>
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        <span className="truncate text-right font-bold">
                          {m.away_team?.name}
                        </span>
                        <Flag
                          emoji={m.away_team?.flag_emoji ?? null}
                          code={m.away_team?.code ?? null}
                          name={m.away_team?.name ?? "TBD"}
                          className="h-6"
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Partidos */}
          <section className="flex flex-col gap-3">
            <SectionHeading>Partidos de hoy</SectionHeading>
            <p className="-mt-1 text-sm text-cream/70">
              Cargá tus predicciones antes de que cierre el fixture.
            </p>
            {nextMatches.length === 0 ? (
              <p className="text-sm text-cream/70">
                No hay partidos abiertos para pronosticar ahora mismo.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {nextMatches.map((m) => {
                  const pick = picksByMatch.get(m.id);
                  return (
                    <MatchCard
                      key={m.id}
                      matchId={m.id}
                      homeName={m.home_team?.name ?? "TBD"}
                      awayName={m.away_team?.name ?? "TBD"}
                      homeFlag={m.home_team?.flag_emoji ?? null}
                      awayFlag={m.away_team?.flag_emoji ?? null}
                      homeCode={m.home_team?.code ?? null}
                      awayCode={m.away_team?.code ?? null}
                      meta={matchMeta(m)}
                      initialHome={pick?.predicted_home ?? 0}
                      initialAway={pick?.predicted_away ?? 0}
                      hasPick={Boolean(pick)}
                      isAutoRandom={pick?.is_auto_random ?? false}
                      variant="editable"
                    />
                  );
                })}
              </div>
            )}
            {upcoming.length > nextMatches.length && (
              <Link
                href="/matches"
                className="text-center text-sm font-semibold text-gold hover:underline"
              >
                Ver los {upcoming.length} partidos →
              </Link>
            )}
          </section>
        </div>

        {/* ASIDE */}
        <aside className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
          {/* Ranking REAL */}
          <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-cream/10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-display text-lg text-cream">🏆 Ranking</h3>
              <Link
                href="/leaderboard"
                className="text-xs font-semibold text-gold hover:underline"
              >
                Ver completo
              </Link>
            </div>
            {!hasScores ? (
              <p className="text-sm text-cream/60">
                El ranking arranca con el primer partido.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {standings.slice(0, 6).map((r, i) => {
                  const isMe = r.user_id === userId;
                  return (
                    <div
                      key={r.user_id ?? i}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-2.5 py-1.5",
                        isMe && "bg-gold/20 ring-1 ring-gold/50",
                      )}
                    >
                      <span className="w-6 text-center text-sm font-bold text-cream/70">
                        {i < 3 ? MEDAL[i] : r.rank}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-cream">
                        {r.nickname ?? "—"}
                        {isMe && <span className="text-cream/60"> (vos)</span>}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums text-gold">
                        {r.total_points ?? 0} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
