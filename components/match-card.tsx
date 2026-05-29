import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/countdown";
import {
  displayStatus,
  matchTimeLabel,
  stageLabels,
  type MatchWithPick,
} from "@/lib/matches";
import { cn } from "@/lib/utils";

function TeamCell({
  team,
  placeholder,
}: {
  team: MatchWithPick["home_team"];
  placeholder: string | null;
}) {
  if (!team) {
    return (
      <div className="flex flex-col items-center text-muted-foreground">
        <span className="text-2xl" aria-hidden>
          ❓
        </span>
        <span className="text-xs mt-1 font-mono">{placeholder ?? "TBD"}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl" aria-hidden>
        {team.flag_emoji ?? "🏳️"}
      </span>
      <span className="text-xs mt-1 font-medium truncate max-w-[7rem]">
        {team.name}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof displayStatus> }) {
  switch (status) {
    case "pending_bracket":
      return <Badge variant="outline">Pendiente de cruce</Badge>;
    case "live":
      return (
        <Badge className="bg-red-600 hover:bg-red-600 text-white">
          En vivo
        </Badge>
      );
    case "finished":
      return <Badge variant="secondary">Finalizado</Badge>;
    case "void":
      return <Badge variant="outline">Anulado</Badge>;
    case "locking_soon":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
          Cierra pronto
        </Badge>
      );
    default:
      return <Badge variant="outline">Programado</Badge>;
  }
}

export function MatchCard({ match }: { match: MatchWithPick }) {
  const status = displayStatus(match);
  const isPending = status === "pending_bracket";
  const isLocked = ["live", "finished", "void"].includes(status);
  const hasPick = match.user_pick !== null;

  const cardContent = (
    <div
      className={cn(
        "border rounded-lg p-4 transition-colors",
        isPending && "opacity-60",
        !isPending && "hover:bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-medium">
          {match.stage?.code === "group" && match.group?.code
            ? `Grupo ${match.group.code}`
            : (match.stage && stageLabels[match.stage.code]) ?? "Partido"}
          {" · #"}
          {match.match_number}
        </span>
        <span>{matchTimeLabel(match.kickoff_at)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamCell team={match.home_team} placeholder={match.home_placeholder} />
        <div className="flex flex-col items-center min-w-[3rem]">
          {match.score_home !== null && match.score_away !== null ? (
            <span className="text-lg font-bold tabular-nums">
              {match.score_home} - {match.score_away}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
          <StatusBadge status={status} />
        </div>
        <TeamCell team={match.away_team} placeholder={match.away_placeholder} />
      </div>

      <div className="flex items-center justify-between mt-3 text-xs">
        <div>
          {hasPick ? (
            <span className="text-green-600 dark:text-green-400 font-medium">
              {match.user_pick!.is_auto_random ? "🎲 auto · " : "✓ "}
              tu pick:{" "}
              <span className="tabular-nums">
                {match.user_pick!.predicted_home}-{match.user_pick!.predicted_away}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {isPending
                ? "Definiendo cruce..."
                : isLocked
                  ? "Sin pick"
                  : "Sin pick todavía"}
            </span>
          )}
        </div>
        {!isLocked && !isPending && (
          <span>
            cierra en <Countdown target={match.lock_at} />
          </span>
        )}
      </div>
    </div>
  );

  if (isPending) {
    return cardContent;
  }
  return (
    <Link href={`/matches/${match.id}`} className="block">
      {cardContent}
    </Link>
  );
}
