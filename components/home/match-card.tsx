"use client";

import { useState, useTransition } from "react";
import { submitPick } from "@/app/(authed)/matches/[matchId]/actions";
import { Flag } from "@/components/flag";

export type MatchCardVariant = "editable" | "locked" | "pending";

interface MatchCardProps {
  matchId: string;
  homeName: string;
  awayName: string;
  homeFlag: string | null;
  awayFlag: string | null;
  homeCode?: string | null;
  awayCode?: string | null;
  meta?: string; // ej. "Grupo A · 16:00"
  initialHome: number | null;
  initialAway: number | null;
  hasPick: boolean;
  isAutoRandom: boolean;
  variant: MatchCardVariant;
  scoreHome?: number | null;
  scoreAway?: number | null;
}

/** Stepper vertical: flechita arriba suma un gol, flechita abajo resta.
 *  Así no hay que escribir el número, se carga tocando. */
function GoalStepper({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const arrowCls =
    "grid h-6 w-12 place-items-center text-pitch transition-transform active:scale-90 disabled:opacity-25 disabled:active:scale-100";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-col items-center rounded-xl border-2 border-ink/15 bg-white py-1"
    >
      <button
        type="button"
        aria-label={`Sumar gol (${ariaLabel})`}
        disabled={disabled || value >= 20}
        onClick={() => onChange(Math.min(20, value + 1))}
        className={arrowCls}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="w-12 text-center text-2xl font-black tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Restar gol (${ariaLabel})`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={arrowCls}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function StatusPill({ variant, hasPick }: { variant: MatchCardVariant; hasPick: boolean }) {
  if (variant === "locked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cardred/15 px-2.5 py-1 text-xs font-bold text-cardred">
        🔒 Cerrado
      </span>
    );
  }
  if (variant === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 text-xs font-bold text-ink/60">
        ⏳ Pendiente
      </span>
    );
  }
  return hasPick ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-grass/15 px-2.5 py-1 text-xs font-bold text-grass">
      ✅ Cargado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-600">
      🕒 Pendiente
    </span>
  );
}

/**
 * Card de partido estilo "Prode de los pibes".
 * Reusa el server action submitPick — no cambia la lógica de picks/lock.
 */
export function MatchCard({
  matchId,
  homeName,
  awayName,
  homeFlag,
  awayFlag,
  homeCode,
  awayCode,
  meta,
  initialHome,
  initialAway,
  hasPick,
  isAutoRandom,
  variant,
  scoreHome,
  scoreAway,
}: MatchCardProps) {
  const [home, setHome] = useState(initialHome ?? 0);
  const [away, setAway] = useState(initialAway ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lockedClient, setLockedClient] = useState(false);
  const [isPending, startTransition] = useTransition();

  const editable = variant === "editable" && !lockedClient;
  const disabled = isPending || !editable;
  const hasScore =
    scoreHome !== null &&
    scoreHome !== undefined &&
    scoreAway !== null &&
    scoreAway !== undefined;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = new FormData();
    form.set("home", String(home));
    form.set("away", String(away));
    startTransition(async () => {
      const res = await submitPick(matchId, form);
      if (res.ok) {
        setSuccess(hasPick ? "¡Pick actualizado!" : "¡Pick cargado!");
      } else {
        setError(res.error);
        if (res.error.toLowerCase().includes("cerró")) setLockedClient(true);
      }
    });
  };

  return (
    <div className="rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      {/* Top: meta + estado */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink/50">
          {meta}
        </span>
        <StatusPill variant={editable ? "editable" : variant} hasPick={hasPick} />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Equipos + marcador/pick */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Flag emoji={homeFlag} code={homeCode} name={homeName} className="h-6" />
            <span className="truncate font-bold">{homeName}</span>
          </div>

          {editable ? (
            <div className="flex items-center gap-2">
              <GoalStepper
                value={home}
                onChange={setHome}
                disabled={disabled}
                ariaLabel={`Goles de ${homeName}`}
              />
              <span className="text-xl font-black text-ink/40">-</span>
              <GoalStepper
                value={away}
                onChange={setAway}
                disabled={disabled}
                ariaLabel={`Goles de ${awayName}`}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center px-1">
              <span className="text-2xl font-black tabular-nums">
                {hasScore ? `${scoreHome}-${scoreAway}` : "–"}
              </span>
              {hasPick && (
                <span className="text-[11px] font-semibold text-ink/55">
                  tu pick {initialHome}-{initialAway}
                  {isAutoRandom && " 🎲"}
                </span>
              )}
            </div>
          )}

          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right font-bold">{awayName}</span>
            <Flag emoji={awayFlag} code={awayCode} name={awayName} className="h-6" />
          </div>
        </div>

        {editable && (
          <>
            <button
              type="submit"
              disabled={disabled}
              className="mt-4 w-full rounded-full bg-pitch px-4 py-2.5 text-sm font-bold text-cream shadow-sm transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
            >
              {isPending
                ? "Guardando..."
                : hasPick
                  ? "Actualizar pronóstico"
                  : "Guardar pronóstico"}
            </button>
            {error && (
              <p className="mt-2 text-center text-xs font-semibold text-cardred">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-2 text-center text-xs font-semibold text-grass">
                {success}
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
