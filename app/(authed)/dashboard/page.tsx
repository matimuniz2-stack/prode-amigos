import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
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

  // Próximos partidos reales (abiertos para pronosticar).
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

  // Picks del usuario para esos partidos (para pre-cargar y contar pendientes).
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
    for (const p of picks ?? []) {
      picksByMatch.set(p.match_id, p);
    }
  }

  const sinCargar = upcoming.filter((m) => !picksByMatch.has(m.id)).length;
  const nextMatches = upcoming.slice(0, 3);
  const nextMatch = upcoming[0] ?? null;
  const nextMatchLabel = nextMatch
    ? `${nextMatch.home_team?.name} vs ${nextMatch.away_team?.name}`
    : "Por definirse";

  const { count: globalsCount } = await supabase
    .from("global_predictions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return (
    <div className="flex flex-col gap-7">
      <HeroHeader />

      <PrimaryButton href="/matches">⚽ Hacer mis pronósticos</PrimaryButton>
      <Link
        href="/reglas"
        className="-mt-3 text-center text-sm font-semibold text-cream/70 hover:text-cream"
      >
        📖 Cómo se juega y los puntajes
      </Link>

      {/* Resumen (todo data real) */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard emoji="⚽" label="Próximo partido">
          <span className="line-clamp-2">{nextMatchLabel}</span>
        </StatCard>
        <StatCard emoji="📋" label="Por jugar">
          <span className="text-lg text-pitch">{upcoming.length}</span> partidos
        </StatCard>
        <StatCard emoji="🕒" label="Sin cargar">
          <span
            className={cn(
              "text-lg",
              sinCargar > 0 ? "text-cardred" : "text-grass",
            )}
          >
            {sinCargar}
          </span>{" "}
          picks
        </StatCard>
      </div>

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
  );
}
