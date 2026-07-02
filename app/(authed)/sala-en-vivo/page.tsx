import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import { LiveRefresher } from "@/components/live-refresher";
import { SectionHeading } from "@/components/home/section-heading";
import {
  MatchOthersPicks,
  type MatchPickEntry,
} from "@/components/match-others-picks";
import { MatchGrieta } from "@/components/match-grieta";
import { LivePitch } from "@/components/live/live-pitch";
import { WhoIsWatching } from "@/components/live/who-is-watching";
import { MatchChat, type ChatMessage } from "@/components/match-chat";
import { scorePrediction, type ScoringRule } from "@/lib/scoring";
import {
  displayStatus,
  matchSelect,
  matchTimeLabel,
  type MatchWithRelations,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

interface PickRow {
  user_id: string;
  match_id: string;
  predicted_winner: string | null;
  predicted_home: number;
  predicted_away: number;
  predicted_ko_winner_team_id: string | null;
  is_auto_random: boolean;
}

export default async function SalaEnVivoPage() {
  if (!hasSupabaseEnv()) redirect("/");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/auth/login");
  const myId = claims.claims.sub as string;
  const now = Date.now();

  const { data: allMatches } = await supabase
    .from("matches")
    .select(matchSelect)
    .order("kickoff_at", { ascending: true })
    .returns<MatchWithRelations[]>();

  const live = (allMatches ?? []).filter(
    (m) => displayStatus(m, now) === "live" && m.home_team && m.away_team,
  );

  if (live.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
        <LiveRefresher enabled />
        <SectionHeading className="pt-1">Sala en vivo</SectionHeading>
        <div className="rounded-2xl border-2 border-dashed border-cream/20 p-8 text-center text-cream/70">
          <p className="text-2xl">🍿</p>
          <p className="mt-2 text-sm">
            No hay partidos en juego ahora mismo. Cuando ruede la pelota, acá vas
            a ver los puntos de todos actualizándose gol a gol.
          </p>
          <Link
            href="/matches"
            className="mt-4 inline-block text-xs font-bold text-gold hover:underline"
          >
            Ver próximos partidos →
          </Link>
        </div>
      </div>
    );
  }

  const liveIds = live.map((m) => m.id);
  const tournamentId = live[0].tournament_id;

  const [
    { data: picks },
    { data: ruleRows },
    { data: profiles },
    { data: proj },
    { data: reactRows },
    { data: chatRows },
  ] = await Promise.all([
    supabase
      .from("match_predictions")
      .select(
        "user_id, match_id, predicted_winner, predicted_home, predicted_away, predicted_ko_winner_team_id, is_auto_random",
      )
      .in("match_id", liveIds)
      .returns<PickRow[]>(),
    supabase
      .from("scoring_rules")
      .select("rule_key, scope_stage, points")
      .eq("tournament_id", tournamentId)
      .is("active_to", null),
    supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .returns<{ id: string; nickname: string; avatar_url: string | null }[]>(),
    supabase
      .from("leaderboard_projection")
      .select("user_id, nickname, total_points, rank")
      .order("rank", { ascending: true }),
    supabase
      .from("pick_reactions")
      .select("match_id, target_user_id, emoji, reactor_user_id")
      .in("match_id", liveIds)
      .returns<
        {
          match_id: string;
          target_user_id: string;
          emoji: string;
          reactor_user_id: string;
        }[]
      >(),
    supabase
      .from("match_chat_messages")
      .select("id, match_id, content, created_at, user_id")
      .in("match_id", liveIds)
      .order("created_at", { ascending: true })
      .returns<
        {
          id: string;
          match_id: string;
          content: string;
          created_at: string;
          user_id: string;
        }[]
      >(),
  ]);

  const rules = (ruleRows ?? []) as ScoringRule[];
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
  const avatarById = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));
  const picksByMatch = new Map<string, PickRow[]>();
  for (const p of picks ?? []) {
    const arr = picksByMatch.get(p.match_id) ?? [];
    arr.push(p);
    picksByMatch.set(p.match_id, arr);
  }

  // Chat de cada partido en vivo (mismo chat que en el detalle del partido).
  const chatByMatch = new Map<string, ChatMessage[]>();
  for (const m of chatRows ?? []) {
    const arr = chatByMatch.get(m.match_id) ?? [];
    arr.push({
      id: m.id,
      nickname: nameById.get(m.user_id) ?? "Jugador",
      content: m.content,
      time: matchTimeLabel(m.created_at),
      isSelf: m.user_id === myId,
      avatarUrl: avatarById.get(m.user_id) ?? null,
    });
    chatByMatch.set(m.match_id, arr);
  }

  // Reacciones: matchId -> targetUserId -> emoji -> {count, mine}
  const reByMatchUser = new Map<
    string,
    Map<string, Map<string, { count: number; mine: boolean }>>
  >();
  for (const r of reactRows ?? []) {
    const byUser = reByMatchUser.get(r.match_id) ?? new Map();
    const byEmoji = byUser.get(r.target_user_id) ?? new Map();
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.reactor_user_id === myId) cur.mine = true;
    byEmoji.set(r.emoji, cur);
    byUser.set(r.target_user_id, byEmoji);
    reByMatchUser.set(r.match_id, byUser);
  }

  // Proyección agregada: cuántos puntos suma cada uno si TODOS los partidos en
  // vivo terminan con el marcador actual.
  const gainByUser = new Map<string, number>();

  const matchBlocks = live.map((m) => {
    const stageCode = m.stage?.code ?? "group";
    const hasScore = m.score_home !== null && m.score_away !== null;
    const entries: MatchPickEntry[] = (picksByMatch.get(m.id) ?? [])
      .map((p) => {
        const points = hasScore
          ? scorePrediction(
              p,
              m.score_home as number,
              m.score_away as number,
              stageCode,
              rules,
            ).points
          : null;
        if (points && points > 0) {
          gainByUser.set(p.user_id, (gainByUser.get(p.user_id) ?? 0) + points);
        }
        return {
          userId: p.user_id,
          nickname: nameById.get(p.user_id) ?? "Jugador",
          predictedHome: p.predicted_home,
          predictedAway: p.predicted_away,
          isAutoRandom: p.is_auto_random,
          points,
          isSelf: p.user_id === myId,
          avatarUrl: avatarById.get(p.user_id) ?? null,
          reactions: [
            ...(reByMatchUser.get(m.id)?.get(p.user_id)?.entries() ?? []),
          ].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
        };
      })
      .sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
    return { match: m, entries, hasScore };
  });

  // Tabla proyectada: total actual + lo que sumaría en vivo → nuevo orden.
  const standings = proj ?? [];
  const projected = standings
    .map((r) => {
      const gain = gainByUser.get(r.user_id ?? "") ?? 0;
      return {
        userId: r.user_id ?? "",
        nickname: r.nickname ?? "—",
        current: r.total_points ?? 0,
        gain,
        projected: (r.total_points ?? 0) + gain,
        oldRank: r.rank ?? 0,
      };
    })
    .sort((a, b) => b.projected - a.projected)
    .map((row, i) => ({ ...row, newRank: i + 1 }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
      <LiveRefresher enabled />
      <SectionHeading className="pt-1">
        🔴 Sala en vivo
      </SectionHeading>

      <WhoIsWatching
        me={{
          id: myId,
          nickname: nameById.get(myId) ?? "vos",
          avatarUrl: avatarById.get(myId) ?? null,
        }}
      />

      {/* Tabla proyectada */}
      <section className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
          📊 Ranking proyectado · si termina así
        </span>
        <div className="flex flex-col">
          {projected.map((p, i) => {
            const move = p.oldRank - p.newRank;
            const isMe = p.userId === myId;
            return (
              <div
                key={p.userId}
                className={cn(
                  "flex items-center gap-3 py-1.5",
                  i > 0 && "border-t border-ink/5",
                  isMe && "rounded-lg bg-gold/15 px-2",
                )}
              >
                <span className="w-5 text-sm font-bold tabular-nums text-ink/50">
                  {p.newRank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {p.nickname}
                  {isMe && <span className="text-ink/50"> (vos)</span>}
                  {move !== 0 && (
                    <span
                      className={cn(
                        "ml-1.5 text-[11px] font-black",
                        move > 0 ? "text-grass" : "text-cardred",
                      )}
                    >
                      {move > 0 ? `▲${move}` : `▼${-move}`}
                    </span>
                  )}
                </span>
                {p.gain > 0 && (
                  <span className="text-xs font-bold text-grass">
                    +{p.gain}
                  </span>
                )}
                <span className="font-black tabular-nums text-ink">
                  {p.projected}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cada partido en vivo */}
      {matchBlocks.map(({ match, entries, hasScore }) => (
        <section
          key={match.id}
          className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/matches/${match.id}`}
              className="min-w-0 truncate text-sm font-extrabold hover:underline"
            >
              {match.home_team?.name} vs {match.away_team?.name}
            </Link>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-lg font-black tabular-nums">
                {hasScore ? `${match.score_home} - ${match.score_away}` : "—"}
              </span>
              <span className="rounded-full bg-cardred/15 px-2 py-0.5 text-[10px] font-bold uppercase text-cardred">
                En vivo
              </span>
            </span>
          </div>

          {/* Cancha en vivo (datos de ESPN: stats, goles posicionados, relato) */}
          <LivePitch
            matchId={match.id}
            myHome={entries.find((e) => e.isSelf)?.predictedHome ?? null}
            myAway={entries.find((e) => e.isSelf)?.predictedAway ?? null}
          />

          {entries.length > 0 ? (
            <>
              <MatchGrieta
                entries={entries}
                homeLabel={match.home_team?.name ?? "Local"}
                awayLabel={match.away_team?.name ?? "Visita"}
              />
              <MatchOthersPicks
                entries={entries}
                finished={false}
                live={hasScore}
                matchId={match.id}
              />
            </>
          ) : (
            <p className="text-sm text-ink/60">Nadie cargó pick para este partido.</p>
          )}

          <MatchChat
            matchId={match.id}
            messages={chatByMatch.get(match.id) ?? []}
          />
        </section>
      ))}
    </div>
  );
}
