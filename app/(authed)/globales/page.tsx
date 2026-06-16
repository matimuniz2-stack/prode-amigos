import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { Countdown } from "@/components/countdown";
import { SectionHeading } from "@/components/home/section-heading";
import { GlobalesForm } from "@/components/globales-form";

export const dynamic = "force-dynamic";

export default async function GlobalesPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, globals_lock_at")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return (
      <p className="pt-2 text-sm text-cream/80">
        No hay torneo configurado todavía.
      </p>
    );
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, flag_emoji")
    .order("name", { ascending: true });

  const { data: picks } = await supabase
    .from("global_predictions")
    .select("category, team_id, player_team_id, player_name, is_auto_random")
    .eq("user_id", userId)
    .eq("tournament_id", tournament.id);

  const byCat = new Map((picks ?? []).map((p) => [p.category, p]));
  const champion = byCat.get("champion");
  const runnerUp = byCat.get("runner_up");
  const topScorer = byCat.get("top_scorer");
  const mvp = byCat.get("mvp");
  const revelation = byCat.get("revelation");

  const initial = {
    champion: champion?.team_id ?? "",
    runner_up: runnerUp?.team_id ?? "",
    top_scorer_team: topScorer?.player_team_id ?? "",
    top_scorer_name: topScorer?.player_name ?? "",
    mvp_team: mvp?.player_team_id ?? "",
    mvp_name: mvp?.player_name ?? "",
    revelation_team: revelation?.player_team_id ?? "",
    revelation_name: revelation?.player_name ?? "",
  };

  const random = {
    champion: !!champion?.is_auto_random,
    runner_up: !!runnerUp?.is_auto_random,
    top_scorer: !!topScorer?.is_auto_random,
    mvp: !!mvp?.is_auto_random,
    revelation: !!revelation?.is_auto_random,
  };
  const anyRandom = Object.values(random).some(Boolean);

  const locked = new Date(tournament.globals_lock_at).getTime() <= Date.now();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2 pt-1">
        <SectionHeading>Globales</SectionHeading>
        <p className="text-sm text-cream/70">
          Tus apuestas grandes del torneo.{" "}
          {locked ? (
            "El cierre ya pasó — quedaron congeladas."
          ) : (
            <>
              Cerrás hasta que arranque el Mundial:{" "}
              <span className="font-semibold text-gold">
                <Countdown target={tournament.globals_lock_at} />
              </span>
              .
            </>
          )}
        </p>
      </header>

      {anyRandom && (
        <div className="rounded-2xl bg-gold/15 p-3 text-sm text-cream ring-1 ring-gold/30">
          🎲 No cargaste algunos globales a tiempo, así que se completaron solos
          con un pick al azar (marcados abajo). Mejor que quedar en cero.
        </div>
      )}

      <GlobalesForm
        teams={teams ?? []}
        initial={initial}
        locked={locked}
        random={random}
      />
    </div>
  );
}
