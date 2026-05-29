import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { matchDayLabel, matchSelect, matchTimeLabel, stageLabels } from "@/lib/matches";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type MatchSummary = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  | "id"
  | "kickoff_at"
  | "status"
  | "score_home"
  | "score_away"
  | "match_number"
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
    pointsByMatch.set(row.source_id, (pointsByMatch.get(row.source_id) ?? 0) + row.points);
  }

  const allPicks = picks ?? [];
  const totalPoints = Array.from(pointsByMatch.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Mi prode</h1>
        <p className="text-sm text-muted-foreground">
          {allPicks.length} pick{allPicks.length === 1 ? "" : "s"} cargado
          {allPicks.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground">{totalPoints} pts</span>{" "}
          acumulados en partidos.
        </p>
      </header>

      {allPicks.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no cargaste ningún pick.
          </p>
          <Link
            href="/matches"
            className="text-sm underline mt-2 inline-block"
          >
            Ver partidos
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3 font-medium">Partido</th>
                <th className="p-3 font-medium">Tu pick</th>
                <th className="p-3 font-medium">Resultado</th>
                <th className="p-3 font-medium text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {allPicks.map((pick) => {
                const m = pick.match;
                if (!m) {
                  return (
                    <tr key={pick.id} className="border-t">
                      <td colSpan={4} className="p-3 text-muted-foreground">
                        (partido eliminado)
                      </td>
                    </tr>
                  );
                }
                const isFinished = m.status === "finished";
                const points = pointsByMatch.get(m.id);
                return (
                  <tr key={pick.id} className="border-t">
                    <td className="p-3">
                      <Link
                        href={`/matches/${m.id}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">
                          {m.home_team?.flag_emoji} {m.home_team?.name ?? "TBD"}
                          {" vs "}
                          {m.away_team?.flag_emoji} {m.away_team?.name ?? "TBD"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {matchDayLabel(m.kickoff_at)} · {matchTimeLabel(m.kickoff_at)}{" "}
                          · {m.stage ? stageLabels[m.stage.code] ?? m.stage.code : ""}
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 tabular-nums">
                      {pick.predicted_home}-{pick.predicted_away}
                      {pick.is_auto_random && (
                        <span
                          className="ml-1 text-xs text-muted-foreground"
                          title="Auto-random porque no cargaste antes del cierre"
                        >
                          🎲
                        </span>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {isFinished && m.score_home !== null && m.score_away !== null
                        ? `${m.score_home}-${m.score_away}`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {points !== undefined ? points : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
