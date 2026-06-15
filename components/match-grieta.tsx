import { cn } from "@/lib/utils";
import type { MatchPickEntry } from "@/components/match-others-picks";

/**
 * "La Grieta": cuántos del grupo fueron a local / empate / visita en este
 * partido. Se calcula del signo del marcador pronosticado. Solo tiene sentido
 * post-lock (cuando los picks ya son visibles).
 */
export function MatchGrieta({
  entries,
  homeLabel,
  awayLabel,
}: {
  entries: MatchPickEntry[];
  homeLabel: string;
  awayLabel: string;
}) {
  const total = entries.length;
  if (total === 0) return null;

  let home = 0;
  let draw = 0;
  let away = 0;
  for (const e of entries) {
    if (e.predictedHome > e.predictedAway) home++;
    else if (e.predictedHome < e.predictedAway) away++;
    else draw++;
  }

  const segs = [
    { key: "home", label: homeLabel, n: home, bar: "bg-grass", text: "text-grass" },
    { key: "draw", label: "Empate", n: draw, bar: "bg-ink/40", text: "text-ink/60" },
    { key: "away", label: awayLabel, n: away, bar: "bg-gold", text: "text-ink" },
  ].filter((s) => s.n > 0);

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-ink/[0.04] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink/45">
          ⚡ La grieta
        </span>
        <span className="text-[11px] text-ink/40">{total} picks</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
        {segs.map((s) => (
          <div
            key={s.key}
            className={cn("h-full", s.bar)}
            style={{ width: `${pct(s.n)}%` }}
            title={`${s.label}: ${s.n}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segs.map((s) => (
          <span key={s.key} className="font-semibold">
            <span className={cn("font-black tabular-nums", s.text)}>{s.n}</span>{" "}
            <span className="text-ink/60">
              {s.label} ({pct(s.n)}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
