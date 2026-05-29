import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import {
  displayStatus,
  matchSelect,
  matchTimeLabel,
  stageLabels,
  type MatchWithRelations,
} from "@/lib/matches";
import { HeroHeader } from "@/components/home/hero-header";
import { PrimaryButton } from "@/components/home/primary-button";
import { StatCard } from "@/components/home/stat-card";
import { SectionHeading } from "@/components/home/section-heading";
import { MatchCard } from "@/components/home/match-card";
import { BadgeChip } from "@/components/home/badge-chip";
import { RankingPodium, RankingList } from "@/components/home/ranking";
import { NewsFeed } from "@/components/home/news-feed";
import {
  DEMO_BADGES,
  DEMO_NEWS,
  DEMO_RANKING,
  DEMO_STANDING,
} from "@/lib/demo-data";

export const dynamic = "force-dynamic";

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

  // Próximos partidos reales (editables): para la sección "Próximos partidos".
  const { data: matchesData } = await supabase
    .from("matches")
    .select(matchSelect)
    .order("kickoff_at", { ascending: true })
    .order("match_number", { ascending: true })
    .returns<MatchWithRelations[]>();

  const now = Date.now();
  const upcoming = (matchesData ?? []).filter((m) => {
    const s = displayStatus(m, now);
    return (
      (s === "upcoming" || s === "locking_soon") && m.home_team && m.away_team
    );
  });
  const nextMatches = upcoming.slice(0, 3);

  // Picks del usuario para esos partidos.
  const picksByMatch = new Map<
    string,
    { predicted_home: number; predicted_away: number; is_auto_random: boolean }
  >();
  if (nextMatches.length > 0) {
    const { data: picks } = await supabase
      .from("match_predictions")
      .select("match_id, predicted_home, predicted_away, is_auto_random")
      .eq("user_id", userId)
      .in(
        "match_id",
        nextMatches.map((m) => m.id),
      );
    for (const p of picks ?? []) {
      picksByMatch.set(p.match_id, p);
    }
  }

  const nextMatch = upcoming[0] ?? null;
  const nextMatchLabel = nextMatch
    ? `${nextMatch.home_team?.name} vs ${nextMatch.away_team?.name}`
    : "Por definirse";

  return (
    <div className="flex flex-col gap-7">
      <HeroHeader />

      <PrimaryButton href="/matches">⚽ Hacer mis pronósticos</PrimaryButton>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard emoji="🏆" label="Puesto actual">
          Vas <span className="text-lg text-pitch">{DEMO_STANDING.position}°</span>{" "}
          de {DEMO_STANDING.total}
        </StatCard>
        <StatCard emoji="⚽" label="Próximo partido">
          <span className="line-clamp-2">{nextMatchLabel}</span>
        </StatCard>
        <StatCard emoji="🔥" label="Racha">
          <span className="text-lg text-pitch">{DEMO_STANDING.streak}</span>{" "}
          pegados
        </StatCard>
      </div>

      {/* Próximos partidos (data real) */}
      <section className="flex animate-fade-up flex-col gap-3">
        <SectionHeading>Próximos partidos</SectionHeading>
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
      </section>

      {/* Logros (mock) */}
      <section className="flex animate-fade-up flex-col gap-3">
        <SectionHeading tag="datos de ejemplo">Logros</SectionHeading>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {DEMO_BADGES.map((b) => (
            <BadgeChip key={b.label} emoji={b.emoji} label={b.label} tone={b.tone} />
          ))}
        </div>
      </section>

      {/* Ranking (mock) */}
      <section className="flex animate-fade-up flex-col gap-4">
        <SectionHeading id="ranking" tag="datos de ejemplo">
          Ranking
        </SectionHeading>
        <RankingPodium players={DEMO_RANKING} />
        <RankingList players={DEMO_RANKING.filter((p) => p.rank > 3)} />
      </section>

      {/* Novedades (mock) */}
      <section className="flex animate-fade-up flex-col gap-3">
        <SectionHeading tag="datos de ejemplo">
          💬 Últimas novedades
        </SectionHeading>
        <NewsFeed items={DEMO_NEWS} />
      </section>
    </div>
  );
}
