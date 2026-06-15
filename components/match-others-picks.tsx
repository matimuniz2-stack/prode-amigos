import { cn } from "@/lib/utils";

export interface MatchPickEntry {
  userId: string;
  nickname: string;
  predictedHome: number;
  predictedAway: number;
  isAutoRandom: boolean;
  /** Nombre del equipo que el jugador eligió que avance (solo KO). */
  koWinnerName: string | null;
  /** Puntos sacados en este partido (null si todavía no se puntuó). */
  points: number | null;
  isSelf: boolean;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function MatchOthersPicks({
  entries,
  finished,
}: {
  entries: MatchPickEntry[];
  finished: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        Nadie cargó pick para este partido.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map((e) => (
        <li
          key={e.userId}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2",
            e.isSelf ? "bg-gold/15 ring-1 ring-gold/40" : "bg-ink/[0.04]",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-sm font-black text-ink/70">
            {initial(e.nickname)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-ink">
              {e.nickname}
              {e.isSelf && <span className="text-ink/50"> (vos)</span>}
            </span>
            {e.koWinnerName && (
              <span className="truncate text-[11px] text-ink/55">
                avanza {e.koWinnerName}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-base font-black tabular-nums text-ink">
              {e.predictedHome}-{e.predictedAway}
              {e.isAutoRandom && <span title="pick auto-random"> 🎲</span>}
            </span>
            {finished && e.points !== null && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums",
                  e.points > 0 ? "bg-gold text-ink" : "bg-ink/10 text-ink/50",
                )}
              >
                {e.points > 0 ? `+${e.points}` : "0"}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
