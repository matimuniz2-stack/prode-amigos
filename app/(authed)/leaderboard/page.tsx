import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { SectionHeading } from "@/components/home/section-heading";
import { TAG_TONE_CLASS, toneForTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

interface Standing {
  userId: string;
  nickname: string;
  points: number;
  rank: number;
  prize: number;
  tags: string[];
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

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
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

  const { data: rows } = await supabase
    .from("leaderboard_projection")
    .select("user_id, nickname, total_points, rank, projected_prize, pool_total, currency")
    .order("rank", { ascending: true });

  const { data: pool } = await supabase
    .from("pools")
    .select("total_amount, currency")
    .maybeSingle();

  const projection = rows ?? [];
  const hasScores = projection.some((r) => (r.total_points ?? 0) > 0);

  const currency = pool?.currency ?? projection[0]?.currency ?? "ARS";
  const poolTotal = pool?.total_amount ?? projection[0]?.pool_total ?? 0;

  // Etiquetas (logros) que el admin le puso a cada participante.
  const { data: tagRows } = await supabase
    .from("profiles")
    .select("id, nickname, tags")
    .order("nickname", { ascending: true })
    .returns<{ id: string; nickname: string; tags: string[] }[]>();
  const tagsByUser = new Map<string, string[]>(
    (tagRows ?? []).map((p) => [p.id, p.tags ?? []]),
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
    }));
  } else {
    // Pre-torneo: nadie puntuó todavía → mostramos a los participantes en 0.
    standings = (tagRows ?? []).map((p) => ({
      userId: p.id,
      nickname: p.nickname ?? "—",
      points: 0,
      rank: 1,
      prize: 0,
      tags: p.tags ?? [],
    }));
  }

  const top3 = hasScores ? standings.slice(0, 3) : [];
  const rest = hasScores ? standings.slice(3) : standings;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <AutoRefresh seconds={30} />

      <SectionHeading className="pt-1">Ranking</SectionHeading>

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
              <div key={s.userId} className="flex flex-1 flex-col items-center gap-1">
                {idx === 0 && (
                  <span aria-hidden className="-mb-1 text-lg">
                    👑
                  </span>
                )}
                <div
                  className={cn(
                    "grid size-11 place-items-center rounded-full bg-cream text-lg font-black text-ink ring-2",
                    m.ring,
                  )}
                >
                  {initial(s.nickname)}
                </div>
                <span className="max-w-full truncate text-sm font-bold text-cream">
                  {s.nickname}
                  {isMe && " (vos)"}
                </span>
                <span className={cn("text-xs font-extrabold tabular-nums", m.pts)}>
                  {s.points} pts
                </span>
                {s.prize > 0 && (
                  <span className="text-[10px] font-bold text-gold/90">
                    {money(s.prize, currency)}
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
              </div>
            );
          })}
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
              <div
                key={s.userId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-ink/10",
                  isMe && "bg-gold/20",
                )}
              >
                <span className="w-6 text-center text-sm font-bold tabular-nums text-ink/50">
                  {hasScores ? s.rank : "–"}
                </span>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
