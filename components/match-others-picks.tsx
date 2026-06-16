import { cn } from "@/lib/utils";
import { PickReactions } from "@/components/pick-reactions";
import { Avatar } from "@/components/avatar";
import type { ReactionCount } from "@/lib/reactions";

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
  /** Reacciones con emoji a este pick (vacío si no se cargaron). */
  reactions?: ReactionCount[];
  avatarUrl?: string | null;
}

export function MatchOthersPicks({
  entries,
  finished,
  live = false,
  matchId,
}: {
  entries: MatchPickEntry[];
  finished: boolean;
  /** Partido en juego: los puntos son proyectados ("si termina así"). */
  live?: boolean;
  /** Si se pasa, habilita reaccionar con emojis a cada pick. */
  matchId?: string;
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
            "flex flex-col gap-1.5 rounded-xl px-3 py-2",
            e.isSelf ? "bg-gold/15 ring-1 ring-gold/40" : "bg-ink/[0.04]",
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar
              src={e.avatarUrl}
              name={e.nickname}
              className="size-8 text-sm"
            />
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
              {(finished || live) && e.points !== null && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums",
                    live
                      ? e.points > 0
                        ? "bg-grass/20 text-grass ring-1 ring-grass/40"
                        : "bg-ink/10 text-ink/40"
                      : e.points > 0
                        ? "bg-gold text-ink"
                        : "bg-ink/10 text-ink/50",
                  )}
                  title={live ? "si termina así" : undefined}
                >
                  {live && "~"}
                  {e.points > 0 ? `+${e.points}` : "0"}
                </span>
              )}
            </div>
          </div>

          {matchId && (
            <PickReactions
              matchId={matchId}
              targetUserId={e.userId}
              reactions={e.reactions ?? []}
              disabled={e.isSelf}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
