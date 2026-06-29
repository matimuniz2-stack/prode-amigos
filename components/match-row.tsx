"use client";

import { useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { PickForm } from "@/components/pick-form";
import { Flag } from "@/components/flag";
import {
  displayStatus,
  matchTimeLabel,
  stageLabels,
  type MatchWithPick,
} from "@/lib/matches";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ReturnType<typeof displayStatus> }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold";
  switch (status) {
    case "pending_bracket":
      return <span className={cn(base, "bg-ink/10 text-ink/60")}>Pendiente</span>;
    case "live":
      return <span className={cn(base, "bg-cardred text-white")}>EN VIVO</span>;
    case "finished":
      return <span className={cn(base, "bg-ink/10 text-ink/70")}>Final</span>;
    case "void":
      return <span className={cn(base, "bg-ink/10 text-ink/50")}>Suspendido</span>;
    case "locking_soon":
      return (
        <span className={cn(base, "bg-amber-400/25 text-amber-700")}>
          Cierra pronto
        </span>
      );
    default:
      return null;
  }
}

function TeamSide({
  flag,
  code,
  name,
  align,
}: {
  flag: string | null;
  code: string | null;
  name: string;
  align: "left" | "right";
}) {
  const flagEl = <Flag emoji={flag} code={code} name={name} className="h-6" />;
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "justify-end",
      )}
    >
      {align === "left" ? (
        <>
          {flagEl}
          <span className="truncate font-bold text-ink">{name}</span>
        </>
      ) : (
        <>
          <span className="truncate text-right font-bold text-ink">{name}</span>
          {flagEl}
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
        "overflow-hidden rounded-2xl bg-cream text-ink shadow-card ring-1 ring-black/5 transition-all",
        open && "ring-2 ring-gold/60",
        isPending && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        className={cn(
          "flex w-full flex-col gap-1.5 p-3.5 text-left",
          canExpand && "cursor-pointer",
        )}
        aria-expanded={open}
      >
        {/* Top: etapa + hora + estado + chevron */}
        <div className="flex items-center justify-between text-xs text-ink/50">
          <span className="font-semibold uppercase tracking-wide">
            {match.stage?.code === "group" && match.group?.code
              ? `Grupo ${match.group.code}`
              : (match.stage && stageLabels[match.stage.code]) ?? "Partido"}
            {" · "}
            {matchTimeLabel(match.kickoff_at)}
          </span>
          <div className="flex items-center gap-2">
            {status === "finished" && match.user_points !== null && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums",
                  match.user_points > 0
                    ? "bg-gold text-ink"
                    : "bg-ink/10 text-ink/50",
                )}
              >
                {match.user_points > 0 ? `+${match.user_points}` : "0"} pts
              </span>
            )}
            <StatusBadge status={status} />
            {canExpand && (
              <span
                className={cn(
                  "text-ink/40 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden
              >
                ▾
              </span>
            )}
          </div>
        </div>

        {/* Main: equipos + marcador/pick */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide
            flag={match.home_team?.flag_emoji ?? null}
            code={match.home_team?.code ?? null}
            name={homeName}
            align="left"
          />
          <div className="flex min-w-[3.5rem] flex-col items-center">
            {match.score_home !== null && match.score_away !== null ? (
              <>
                <span className="text-lg font-black tabular-nums">
                  {match.score_home} - {match.score_away}
                </span>
                {hasPick && (
                  <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-grass">
                    tu pick {match.user_pick!.predicted_home}-
                    {match.user_pick!.predicted_away}
                    {match.user_pick!.is_auto_random && " 🎲"}
                  </span>
                )}
              </>
            ) : hasPick && !isPending ? (
              <span className="text-sm font-bold tabular-nums text-grass">
                {match.user_pick!.predicted_home}-
                {match.user_pick!.predicted_away}
                {match.user_pick!.is_auto_random && " 🎲"}
              </span>
            ) : (
              <span className="text-xs text-ink/40">vs</span>
            )}
          </div>
          <TeamSide
            flag={match.away_team?.flag_emoji ?? null}
            code={match.away_team?.code ?? null}
            name={awayName}
            align="right"
          />
        </div>

        {/* Bottom: estado del pick + countdown */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink/55">
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
            <span className="text-ink/55">
              cierra en <Countdown target={match.lock_at} />
            </span>
          )}
        </div>
      </button>

      {/* Cuerpo expandido */}
      {open && canExpand && (
        <div className="border-t border-ink/10 bg-ink/[0.03] p-4">
          {isPending ? (
            <p className="text-center text-sm text-ink/60">
              Cuando termine la fase previa y se defina el cruce vas a poder
              cargar tu pick.
            </p>
          ) : isLocked ? (
            <div className="flex flex-col gap-2 text-sm text-ink">
              {hasPick ? (
                <p>
                  Tu pick fue{" "}
                  <span className="font-black tabular-nums">
                    {match.user_pick!.predicted_home}-
                    {match.user_pick!.predicted_away}
                  </span>
                  {match.user_pick!.is_auto_random && (
                    <span className="text-ink/55"> (auto-random)</span>
                  )}
                  .
                </p>
              ) : (
                <p className="text-ink/60">No cargaste pick antes del cierre.</p>
              )}
              {status === "finished" &&
                match.score_home !== null &&
                match.score_away !== null && (
                  <p>
                    Final:{" "}
                    <span className="font-black tabular-nums">
                      {match.score_home}-{match.score_away}
                    </span>
                  </p>
                )}
              <Link
                href={`/matches/${match.id}`}
                className="text-xs font-semibold text-ink/55 underline hover:text-ink"
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
                homeCode={match.home_team.code}
                awayCode={match.away_team.code}
                initialHome={match.user_pick?.predicted_home ?? 0}
                initialAway={match.user_pick?.predicted_away ?? 0}
                hasPick={hasPick}
                isAutoRandom={match.user_pick?.is_auto_random ?? false}
                isKO={match.stage?.code !== "group"}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
