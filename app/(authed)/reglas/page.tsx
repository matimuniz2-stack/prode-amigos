import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";
import { stageLabels } from "@/lib/matches";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "tp", "final"];

const GLOBAL_LABELS: Record<string, string> = {
  champion: "🏆 Campeón",
  runner_up: "🥈 Subcampeón",
  top_scorer: "👟 Goleador",
  mvp: "⭐ MVP",
  revelation: "🌟 Revelación",
};

export default async function ReglasPage() {
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("scoring_rules")
    .select("rule_key, scope_stage, points");
  const all = rules ?? [];

  const findPts = (key: string, stage: string | null) =>
    all.find((r) => r.rule_key === key && r.scope_stage === stage)?.points;

  const matchRows = STAGE_ORDER.map((code) => ({
    code,
    label: stageLabels[code] ?? code,
    winner: findPts("winner_correct", code),
    exact: findPts("exact_score", code),
  })).filter((r) => r.winner != null || r.exact != null);

  const goalDiff =
    all.find((r) => r.rule_key === "goal_diff_correct")?.points ?? null;

  const globalRows = ["champion", "runner_up", "top_scorer", "mvp", "revelation"]
    .map((k) => ({
      label: GLOBAL_LABELS[k],
      points: findPts(k, null) ?? all.find((r) => r.rule_key === k)?.points,
    }))
    .filter((r) => r.points != null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <SectionHeading className="pt-1">Cómo se juega</SectionHeading>

      <div className="rounded-2xl bg-cream p-4 text-sm leading-relaxed text-ink shadow-card ring-1 ring-black/5">
        Predecí el resultado de <b>cada partido</b> del Mundial y tus{" "}
        <b>globales</b> (campeón, goleador y compañía). Cuanto más le pegás, más
        puntos sumás. El que termina arriba en el ranking se lleva la mayor
        tajada del pozo. 🏆
      </div>

      {/* Puntos por partido */}
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-cream/70">
          Puntos por partido
        </h3>
        <div className="overflow-hidden rounded-2xl bg-cream text-ink shadow-card ring-1 ring-black/5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-ink/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/50">
            <span>Etapa</span>
            <span className="text-right">Acierto</span>
            <span className="text-right">Exacto</span>
          </div>
          {matchRows.map((r) => (
            <div
              key={r.code}
              className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-ink/5 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="font-semibold">{r.label}</span>
              <span className="text-right font-bold tabular-nums">
                {r.winner ?? "—"}
              </span>
              <span className="text-right font-bold tabular-nums text-grass">
                {r.exact != null ? `+${r.exact}` : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="px-1 text-xs text-cream/60">
          <b>Acierto</b>: le pegaste al ganador (o al empate).{" "}
          <b>Exacto</b>: clavaste el resultado (suma además del acierto).
          {goalDiff != null &&
            ` Si no clavás el resultado pero sí la diferencia de gol: +${goalDiff}.`}{" "}
          En <b>eliminación</b> (16avos en adelante) se puntúa por el resultado de
          los <b>120&apos;</b>: si empatan y se define por penales, vale el empate.
          No importa quién pasa.
        </p>
      </section>

      {/* Puntos globales */}
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-cream/70">
          Puntos globales
        </h3>
        <div className="overflow-hidden rounded-2xl bg-cream text-ink shadow-card ring-1 ring-black/5">
          {globalRows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-ink/5 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="font-semibold">{r.label}</span>
              <span className="font-bold tabular-nums text-gold">
                +{r.points}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Cierres */}
      <section className="rounded-2xl bg-cream p-4 text-sm leading-relaxed text-ink shadow-card ring-1 ring-black/5">
        <h3 className="font-extrabold">⏰ Cierres y reglas</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/80">
          <li>
            Cada partido cierra <b>al arrancar</b> (al kickoff). Después no se
            toca el pick.
          </li>
          <li>
            Si no cargás antes del cierre, te ponemos un pick <b>al azar</b> 🎲.
          </li>
          <li>
            Los <b>globales</b> cierran cuando arranca el Mundial (11 de junio).
          </li>
          <li>
            Los picks de los demás se ven <b>recién cuando cierra cada
            partido</b> — nada de espiar antes.
          </li>
        </ul>
      </section>

      <div className="flex justify-center">
        <Link
          href="/matches"
          className="text-sm font-semibold text-gold hover:underline"
        >
          Ir a cargar mis picks →
        </Link>
      </div>
    </div>
  );
}
