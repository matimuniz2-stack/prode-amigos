import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import {
  matchDayLabel,
  matchSelect,
  matchTimeLabel,
  stageLabels,
} from "@/lib/matches";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type MatchSummary = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  "id" | "kickoff_at" | "status" | "score_home" | "score_away" | "match_number"
> & {
  home_team: { code: string; name: string; flag_emoji: string | null } | null;
  away_team: { code: string; name: string; flag_emoji: string | null } | null;
  stage: { code: string } | null;
};

type PickWithMatch = Pick<
  Database["public"]["Tables"]["match_predictions"]["Row"],
  | "id"
  | "match_id"
  | "predicted_home"
  | "predicted_away"
  | "predicted_winner"
  | "is_auto_random"
  | "state"
  | "updated_at"
> & {
  match: MatchSummary | null;
};

export default async function MiProdePage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: picks } = await supabase
    .from("match_predictions")
    .select(
      `id, match_id, predicted_home, predicted_away, predicted_winner,
       is_auto_random, state, updated_at,
       match:matches(${matchSelect.replace("*,", "id, kickoff_at, status, score_home, score_away, match_number,")})`,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<PickWithMatch[]>();

  const { data: points } = await supabase
    .from("points_log")
    .select("source_id, points")
    .eq("user_id", userId)
    .eq("source_kind", "match");

  const pointsByMatch = new Map<string, number>();
  for (const row of points ?? []) {
    pointsByMatch.set(
      row.source_id,
      (pointsByMatch.get(row.source_id) ?? 0) + row.points,
    );
  }

  const allPicks = picks ?? [];
  const totalPoints = Array.from(pointsByMatch.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 pt-1">
        <h1 className="text-display text-3xl text-cream">Mi prode</h1>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-cream px-3 py-1 text-sm font-bold text-ink">
            {allPicks.length} pick{allPicks.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-ink">
            {totalPoints} pts
          </span>
        </div>
      </header>

      {allPicks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-cream/20 p-8 text-center">
          <p className="text-sm text-cream/70">
            Todavía no cargaste ningún pick.
          </p>
          <Link
            href="/matches"
            className="mt-3 inline-block font-semibold text-gold hover:underline"
          >
            Ver partidos →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {allPicks.map((pick) => {
            const m = pick.match;
            if (!m) {
              return (
                <div
                  key={pick.id}
                  className="rounded-2xl bg-cream/80 p-3.5 text-sm text-ink/60 ring-1 ring-black/5"
                >
                  (partido eliminado)
                </div>
              );
            }
            const isFinished = m.status === "finished";
            const pts = pointsByMatch.get(m.id);
            return (
              <Link
                key={pick.id}
                href={`/matches/${m.id}`}
                className="block rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-ink/50">
                  <span className="truncate font-semibold uppercase tracking-wide">
                    {matchDayLabel(m.kickoff_at)} · {matchTimeLabel(m.kickoff_at)}
                    {m.stage
                      ? ` · ${stageLabels[m.stage.code] ?? m.stage.code}`
                      : ""}
                  </span>
                  {pts !== undefined && (
                    <span className="shrink-0 rounded-full bg-pitch/10 px-2 py-0.5 font-bold text-pitch">
                      +{pts} pts
                    </span>
                  )}
                </div>

                <p className="mt-1.5 font-bold leading-snug">
                  {m.home_team?.flag_emoji} {m.home_team?.name ?? "TBD"}{" "}
                  <span className="text-ink/40">vs</span>{" "}
                  {m.away_team?.flag_emoji} {m.away_team?.name ?? "TBD"}
                </p>

                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span>
                    Tu pick:{" "}
                    <b className="tabular-nums">
                      {pick.predicted_home}-{pick.predicted_away}
                    </b>
                    {pick.is_auto_random && (
                      <span title="Auto-random porque no cargaste antes del cierre">
                        {" "}
                        🎲
                      </span>
                    )}
                  </span>
                  <span className="text-ink/55">
                    Resultado:{" "}
                    {isFinished &&
                    m.score_home !== null &&
                    m.score_away !== null ? (
                      <b className="tabular-nums text-ink">
                        {m.score_home}-{m.score_away}
                      </b>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
