"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/countdown";
import { PickForm } from "@/components/pick-form";
import {
  displayStatus,
  matchTimeLabel,
  stageLabels,
  type MatchWithPick,
} from "@/lib/matches";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ReturnType<typeof displayStatus> }) {
  switch (status) {
    case "pending_bracket":
      return <Badge variant="outline">Pendiente</Badge>;
    case "live":
      return (
        <Badge className="bg-red-600 hover:bg-red-600 text-white">EN VIVO</Badge>
      );
    case "finished":
      return <Badge variant="secondary">Final</Badge>;
    case "void":
      return <Badge variant="outline">Anulado</Badge>;
    case "locking_soon":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
          Cierra pronto
        </Badge>
      );
    default:
      return null;
  }
}

function TeamSide({
  flag,
  name,
  align,
}: {
  flag: string | null;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-0",
        align === "right" && "justify-end",
      )}
    >
      {align === "left" ? (
        <>
          <span className="text-xl" aria-hidden>
            {flag ?? "🏳️"}
          </span>
          <span className="font-medium truncate">{name}</span>
        </>
      ) : (
        <>
          <span className="font-medium truncate">{name}</span>
          <span className="text-xl" aria-hidden>
            {flag ?? "🏳️"}
          </span>
        </>
      )}
    </div>
  );
}

export function MatchRow({ match }: { match: MatchWithPick }) {
  const [open, setOpen] = useState(false);
  const status = displayStatus(match);
  const isPending = status === "pending_bracket";
  const isVoid = status === "void";
  const isLocked = status === "live" || status === "finished";
  const hasPick = match.user_pick !== null;
  const canExpand = !isVoid;

  const homeName = match.home_team?.name ?? match.home_placeholder ?? "TBD";
  const awayName = match.away_team?.name ?? match.away_placeholder ?? "TBD";

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        open && "ring-1 ring-foreground/10",
        isPending && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        className={cn(
          "w-full text-left p-3 flex flex-col gap-1",
          canExpand && "hover:bg-accent/40 cursor-pointer",
        )}
        aria-expanded={open}
      >
        {/* Top row: stage label + status + chevron */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {match.stage?.code === "group" && match.group?.code
              ? `Grupo ${match.group.code}`
              : (match.stage && stageLabels[match.stage.code]) ?? "Partido"}
            {" · "}
            {matchTimeLabel(match.kickoff_at)}
          </span>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {canExpand && (
              <span
                className={cn(
                  "transition-transform text-muted-foreground",
                  open && "rotate-180",
                )}
                aria-hidden
              >
                ▾
              </span>
            )}
          </div>
        </div>

        {/* Main row: teams + score/pick */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide
            flag={match.home_team?.flag_emoji ?? null}
            name={homeName}
            align="left"
          />
          <div className="flex flex-col items-center min-w-[3.5rem]">
            {match.score_home !== null && match.score_away !== null ? (
              <span className="text-lg font-bold tabular-nums">
                {match.score_home} - {match.score_away}
              </span>
            ) : hasPick && !isPending ? (
              <span className="text-sm tabular-nums text-green-600 dark:text-green-400">
                {match.user_pick!.predicted_home}-{match.user_pick!.predicted_away}
                {match.user_pick!.is_auto_random && " 🎲"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">vs</span>
            )}
          </div>
          <TeamSide
            flag={match.away_team?.flag_emoji ?? null}
            name={awayName}
            align="right"
          />
        </div>

        {/* Bottom row: countdown or pick state */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {isPending
              ? "Definiendo cruce..."
              : hasPick
                ? match.user_pick!.is_auto_random
                  ? "🎲 pick auto-random"
                  : "✓ pick cargado"
                : isLocked
                  ? "sin pick"
                  : "sin pick todavía"}
          </span>
          {!isLocked && !isPending && !isVoid && (
            <span className="text-muted-foreground">
              cierra en <Countdown target={match.lock_at} />
            </span>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {open && canExpand && (
        <div className="border-t p-4 bg-muted/20">
          {isPending ? (
            <p className="text-sm text-muted-foreground text-center">
              Cuando termine la fase previa y se defina el cruce vas a poder
              cargar tu pick.
            </p>
          ) : isLocked ? (
            <div className="flex flex-col gap-2 text-sm">
              {hasPick ? (
                <p>
                  Tu pick fue{" "}
                  <span className="font-bold tabular-nums">
                    {match.user_pick!.predicted_home}-{match.user_pick!.predicted_away}
                  </span>
                  {match.user_pick!.is_auto_random && (
                    <span className="text-muted-foreground"> (auto-random)</span>
                  )}
                  .
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No cargaste pick antes del cierre.
                </p>
              )}
              {status === "finished" &&
                match.score_home !== null &&
                match.score_away !== null && (
                  <p>
                    Final:{" "}
                    <span className="font-bold tabular-nums">
                      {match.score_home}-{match.score_away}
                    </span>
                  </p>
                )}
              <Link
                href={`/matches/${match.id}`}
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                ver detalle del partido
              </Link>
            </div>
          ) : (
            match.home_team &&
            match.away_team && (
              <PickForm
                matchId={match.id}
                lockAt={match.lock_at}
                homeTeamName={match.home_team.name}
                awayTeamName={match.away_team.name}
                homeFlag={match.home_team.flag_emoji}
                awayFlag={match.away_team.flag_emoji}
                initialHome={match.user_pick?.predicted_home ?? 0}
                initialAway={match.user_pick?.predicted_away ?? 0}
                hasPick={hasPick}
                isAutoRandom={match.user_pick?.is_auto_random ?? false}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
