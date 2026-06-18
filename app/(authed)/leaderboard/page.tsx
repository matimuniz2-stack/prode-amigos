import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { SectionHeading } from "@/components/home/section-heading";
import { TAG_TONE_CLASS, toneForTag } from "@/lib/tags";
import { computeAutoBadges } from "@/lib/badges";
import { computeCareer } from "@/lib/career";
import { CareerChart } from "@/components/leaderboard/career-chart";
import { Avatar } from "@/components/avatar";
import { CrownedAvatar } from "@/components/crowned-avatar";
import { ShareButton } from "@/components/share-button";

export const dynamic = "force-dynamic";

interface Standing {
  userId: string;
  nickname: string;
  points: number;
  rank: number;
  prize: number;
  tags: string[];
  featuredTag: string | null;
  avatarUrl: string | null;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

/** Flecha de movimiento en el ranking. delta>0 = subio puestos. */
function Move({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) {
    return <span className="text-[11px] font-bold text-ink/30">=</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "text-[11px] font-black tabular-nums",
        up ? "text-grass" : "text-cardred",
      )}
      title={up ? `subió ${delta}` : `bajó ${-delta}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

// Meta por puesto del podio (índice 0 = 1°, 1 = 2°, 2 = 3°).
const PODIUM = [
  { bar: "h-20 bg-gradient-to-b from-gold to-amber-500", ring: "ring-gold", medal: "🥇", pts: "text-gold" },
  { bar: "h-14 bg-gradient-to-b from-slate-200 to-slate-400", ring: "ring-slate-300", medal: "🥈", pts: "text-cream/70" },
  { bar: "h-10 bg-gradient-to-b from-amber-600 to-amber-800", ring: "ring-amber-600", medal: "🥉", pts: "text-cream/70" },
];

export default async function LeaderboardPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const myId = claims.claims.sub as string;

  // Las 4 lecturas son independientes → en paralelo (antes iban en cadena).
  const [{ data: rows }, { data: pool }, { data: tagRows }, autoBadges] =
    await Promise.all([
      supabase
        .from("leaderboard_projection")
        .select(
          "user_id, nickname, total_points, rank, projected_prize, pool_total, currency, avatar_url",
        )
        .order("rank", { ascending: true }),
      supabase.from("pools").select("total_amount, currency").maybeSingle(),
      supabase
        .from("profiles")
        .select("id, nickname, tags, avatar_url, featured_tag")
        .order("nickname", { ascending: true })
        .returns<
          {
            id: string;
            nickname: string;
            tags: string[];
            avatar_url: string | null;
            featured_tag: string | null;
          }[]
        >(),
      computeAutoBadges(supabase),
    ]);

  const projection = rows ?? [];
  const hasScores = projection.some((r) => (r.total_points ?? 0) > 0);

  const currency = pool?.currency ?? projection[0]?.currency ?? "ARS";
  const poolTotal = pool?.total_amount ?? projection[0]?.pool_total ?? 0;

  // Etiquetas manuales (admin) + insignias automáticas: ya vienen del
  // Promise.all de arriba (tagRows + autoBadges).
  const avatarByUser = new Map(
    (tagRows ?? []).map((p) => [p.id, p.avatar_url]),
  );
  const featuredByUser = new Map(
    (tagRows ?? []).map((p) => [p.id, p.featured_tag]),
  );
  // La insignia destacada va primera en la lista de chips.
  const tagsFor = (userId: string, manual: string[]) => {
    const all = [
      ...new Set([...(manual ?? []), ...(autoBadges.get(userId) ?? [])]),
    ];
    const feat = featuredByUser.get(userId);
    return feat && all.includes(feat)
      ? [feat, ...all.filter((t) => t !== feat)]
      : all;
  };
  const tagsByUser = new Map<string, string[]>(
    (tagRows ?? []).map((p) => [p.id, tagsFor(p.id, p.tags)]),
  );

  let standings: Standing[];
  if (hasScores) {
    standings = projection.map((r) => ({
      userId: r.user_id ?? "",
      nickname: r.nickname ?? "—",
      points: r.total_points ?? 0,
      rank: r.rank ?? 0,
      prize: r.projected_prize ?? 0,
      tags: tagsByUser.get(r.user_id ?? "") ?? [],
      featuredTag: featuredByUser.get(r.user_id ?? "") ?? null,
      avatarUrl: r.avatar_url ?? null,
    }));
  } else {
    // Pre-torneo: nadie puntuó todavía → mostramos a los participantes en 0.
    standings = (tagRows ?? []).map((p) => ({
      userId: p.id,
      nickname: p.nickname ?? "—",
      points: 0,
      rank: 1,
      prize: 0,
      tags: tagsByUser.get(p.id) ?? [],
      featuredTag: p.featured_tag ?? null,
      avatarUrl: p.avatar_url ?? null,
    }));
  }

  const top3 = hasScores ? standings.slice(0, 3) : [];
  const rest = hasScores ? standings.slice(3) : standings;

  // "Tu pelea": rival de arriba (al que persigo) y de abajo (el que me persigue).
  const myIdx = standings.findIndex((s) => s.userId === myId);
  const me = myIdx >= 0 ? standings[myIdx] : null;
  const chasing = myIdx > 0 ? standings[myIdx - 1] : null;
  const chaser =
    myIdx >= 0 && myIdx < standings.length - 1 ? standings[myIdx + 1] : null;
  const gapLabel = (n: number) =>
    n === 0 ? "empate" : `${n} pt${n === 1 ? "" : "s"}`;

  // Movimiento ▲▼: rank actual vs la foto mas reciente del ranking.
  // delta > 0 = subio puestos (el numero de rank bajo). Si no hay baseline
  // (tabla recien creada o sin partidos) queda vacio y no se muestra flecha.
  const prevRankByUser = new Map<string, number>();
  if (hasScores) {
    const { data: lastSnap } = await supabase
      .from("leaderboard_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSnap?.snapshot_date) {
      const { data: baseRows } = await supabase
        .from("leaderboard_snapshots")
        .select("user_id, rank")
        .eq("snapshot_date", lastSnap.snapshot_date);
      for (const r of baseRows ?? []) prevRankByUser.set(r.user_id, r.rank);
    }
  }
  const moveOf = (userId: string, rank: number): number | null => {
    const prev = prevRankByUser.get(userId);
    return prev === undefined ? null : prev - rank;
  };
  const myMove = me ? moveOf(me.userId, me.rank) : null;

  // Gráfico de la carrera: acumulado por fecha (solo si ya se jugó algo).
  const career = hasScores ? await computeCareer(supabase) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <AutoRefresh seconds={60} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <SectionHeading>Ranking</SectionHeading>
        {hasScores && (
          <ShareButton
            endpoint="/api/share/ranking"
            filename="tabla-prode.png"
            label="Compartir tabla"
            text="La tabla del prode 🏆⚽"
          />
        )}
      </div>

      {/* Pozo */}
      <div className="rounded-2xl bg-gradient-to-br from-gold to-amber-500 p-4 text-ink shadow-card ring-1 ring-black/10">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink/70">
          🏆 Pozo del Mundial
        </div>
        <div className="text-3xl font-black tabular-nums">
          {money(poolTotal, currency)}
        </div>
        <div className="text-xs font-medium text-ink/70">
          {poolTotal > 0
            ? "se reparte 60/25/15 entre los 3 primeros"
            : "lo carga el admin antes de que arranque"}
        </div>
      </div>

      {/* Podio (solo si ya hay puntos) */}
      {hasScores && top3.length > 0 && (
        <div className="flex items-end justify-center gap-3">
          {[1, 0, 2].map((idx) => {
            const s = top3[idx];
            if (!s) return null;
            const m = PODIUM[idx];
            const isMe = s.userId === myId;
            return (
              <Link
                key={s.userId}
                href={`/jugador/${s.userId}`}
                className="flex flex-1 flex-col items-center gap-1 transition-transform active:scale-95"
              >
                <CrownedAvatar
                  crowned={idx === 0}
                  src={s.avatarUrl}
                  name={s.nickname}
                  className={cn("size-16 text-2xl ring-2", m.ring)}
                />
                <span className="max-w-full truncate text-sm font-bold text-cream">
                  {s.nickname}
                  {isMe && " (vos)"}
                </span>
                <span className={cn("text-xs font-extrabold tabular-nums", m.pts)}>
                  {s.points} pts
                </span>
                <Move delta={moveOf(s.userId, s.rank)} />
                {s.prize > 0 && (
                  <span className="text-[10px] font-bold text-gold/90">
                    {money(s.prize, currency)}
                  </span>
                )}
                {s.tags.length > 0 && (
                  <span className="flex flex-wrap justify-center gap-1">
                    {s.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                          TAG_TONE_CLASS[toneForTag(t)],
                          t === s.featuredTag && "ring-2 ring-gold",
                        )}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}
                <div
                  className={cn(
                    "flex w-full items-start justify-center rounded-t-xl pt-1.5 text-xl font-black text-ink/80",
                    m.bar,
                  )}
                >
                  {m.medal}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Tu pelea: distancia con el de arriba y el de abajo */}
      {hasScores && me && (
        <div className="rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
            ⚔️ Tu pelea
          </div>
          <div className="mt-1.5 flex flex-col gap-1 text-sm">
            {myMove !== null && myMove !== 0 && (
              <p className="font-bold">
                {myMove > 0 ? (
                  <span className="text-grass">
                    🔥 Subiste {myMove} puesto{myMove === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-cardred">
                    😬 Bajaste {-myMove} puesto{myMove === -1 ? "" : "s"}
                  </span>
                )}{" "}
                desde la última fecha
              </p>
            )}
            {chasing ? (
              <p>
                Vas <span className="font-black tabular-nums">{me.rank}°</span> — a{" "}
                <span className="font-black tabular-nums text-cardred">
                  {gapLabel(chasing.points - me.points)}
                </span>{" "}
                de <span className="font-semibold">{chasing.nickname}</span>
              </p>
            ) : (
              <p className="font-bold text-pitch">
                👑 Vas puntero — no aflojes
              </p>
            )}
            {chaser && (
              <p className="text-ink/70">
                <span className="font-semibold text-ink">{chaser.nickname}</span>{" "}
                te sigue a{" "}
                <span className="font-black tabular-nums">
                  {gapLabel(me.points - chaser.points)}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {!hasScores && (
        <p className="text-sm text-cream/70">
          Todavía no se jugó ningún partido — el ranking arranca con el primer
          resultado.
        </p>
      )}

      {/* Lista */}
      {rest.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-cream shadow-card ring-1 ring-black/5">
          {rest.map((s, i) => {
            const isMe = s.userId === myId;
            return (
              <Link
                key={s.userId}
                href={`/jugador/${s.userId}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition active:bg-ink/[0.03]",
                  i > 0 && "border-t border-ink/10",
                  isMe && "bg-gold/20",
                )}
              >
                <span className="flex w-9 flex-col items-center leading-tight">
                  <span className="text-sm font-bold tabular-nums text-ink/50">
                    {hasScores ? s.rank : "–"}
                  </span>
                  {hasScores && <Move delta={moveOf(s.userId, s.rank)} />}
                </span>
                <Avatar
                  src={s.avatarUrl}
                  name={s.nickname}
                  className="size-12 text-base"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold text-ink">
                    {s.nickname}
                    {isMe && <span className="text-ink/50"> (vos)</span>}
                  </span>
                  {s.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            TAG_TONE_CLASS[toneForTag(t)],
                            t === s.featuredTag && "ring-2 ring-gold",
                          )}
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                {hasScores && s.prize > 0 && (
                  <span className="text-xs font-bold text-pitch">
                    {money(s.prize, currency)}
                  </span>
                )}
                <span className="font-extrabold tabular-nums text-ink">
                  {s.points}
                  <span className="ml-0.5 text-xs font-semibold text-ink/50">
                    pts
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {career && career.days.length > 0 && (
        <CareerChart career={career} myId={myId} />
      )}
    </div>
  );
}
