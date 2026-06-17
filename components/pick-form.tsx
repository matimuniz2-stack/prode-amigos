"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { Flag } from "@/components/flag";
import { submitPick } from "@/app/(authed)/matches/[matchId]/actions";
import { cn } from "@/lib/utils";
import { RelatorToast } from "@/components/effects/relator-toast";
import { FechaCompleta } from "@/components/effects/fecha-completa";

interface PickFormProps {
  matchId: string;
  lockAt: string;
  homeTeamName: string;
  awayTeamName: string;
  homeFlag: string | null;
  awayFlag: string | null;
  homeCode?: string | null;
  awayCode?: string | null;
  initialHome: number;
  initialAway: number;
  hasPick: boolean;
  isAutoRandom: boolean;
  isKO?: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  initialKoWinner?: string | null;
}

function Stepper({
  teamName,
  flag,
  value,
  setValue,
  disabled,
}: {
  teamName: string;
  flag: ReactNode;
  value: number;
  setValue: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-ink/70">
        {flag}
        <span className="truncate">{teamName}</span>
      </span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setValue(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          aria-label={`Restar gol a ${teamName}`}
          className="grid size-9 place-items-center rounded-full bg-pitch text-xl font-bold text-cream transition-transform active:scale-90 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-10 text-center text-3xl font-black tabular-nums text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => setValue(Math.min(20, value + 1))}
          disabled={disabled || value >= 20}
          aria-label={`Sumar gol a ${teamName}`}
          className="grid size-9 place-items-center rounded-full bg-pitch text-xl font-bold text-cream transition-transform active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PickForm({
  matchId,
  lockAt,
  homeTeamName,
  awayTeamName,
  homeFlag,
  awayFlag,
  homeCode,
  awayCode,
  initialHome,
  initialAway,
  hasPick,
  isAutoRandom,
  isKO = false,
  homeTeamId,
  awayTeamId,
  initialKoWinner,
}: PickFormProps) {
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);
  const [koWinner, setKoWinner] = useState(initialKoWinner ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(
    null,
  );
  const [fechaDone, setFechaDone] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lockedClient, setLockedClient] = useState(false);

  const isDraw = home === away;
  const winnerLabel =
    home > away
      ? `Gana ${homeTeamName}`
      : home < away
        ? `Gana ${awayTeamName}`
        : isKO
          ? "Empate en los 90'"
          : "Empate";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (isKO && isDraw && !koWinner) {
      setError("Empataron en los 90': elegí quién pasa.");
      return;
    }
    const form = new FormData();
    form.set("home", String(home));
    form.set("away", String(away));
    if (isKO && isDraw && koWinner) form.set("koWinner", koWinner);
    startTransition(async () => {
      const res = await submitPick(matchId, form);
      if (res.ok) {
        setSuccess(hasPick ? "Pick actualizado." : "Pick cargado.");
        setToast({
          title: hasPick ? "¡PICK ACTUALIZADO!" : "¡PICK CARGADO!",
          sub: `${homeTeamName} ${home}-${away} ${awayTeamName}`,
        });
        if (res.fechaDone) setFechaDone(res.fechaTotal ?? 0);
      } else {
        setError(res.error);
        if (res.error.toLowerCase().includes("cerró")) {
          setLockedClient(true);
        }
      }
    });
  };

  const disabled = isPending || lockedClient;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-start justify-around gap-2">
        <Stepper
          teamName={homeTeamName}
          flag={<Flag emoji={homeFlag} code={homeCode} name={homeTeamName} className="h-5" />}
          value={home}
          setValue={setHome}
          disabled={disabled}
        />
        <span className="mt-9 text-2xl font-black text-ink/30">-</span>
        <Stepper
          teamName={awayTeamName}
          flag={<Flag emoji={awayFlag} code={awayCode} name={awayTeamName} className="h-5" />}
          value={away}
          setValue={setAway}
          disabled={disabled}
        />
      </div>

      <p className="text-center text-sm font-semibold text-ink">{winnerLabel}</p>

      {/* Eliminación: quién pasa */}
      {isKO &&
        (isDraw ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-ink/60">
              Empataron — ¿quién pasa? (penales/alargue)
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setKoWinner(homeTeamId ?? "")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 transition-colors disabled:opacity-50",
                  koWinner && koWinner === homeTeamId
                    ? "bg-pitch text-cream ring-pitch"
                    : "bg-white text-ink ring-ink/15 hover:ring-gold",
                )}
              >
                <Flag emoji={homeFlag} code={homeCode} name={homeTeamName} className="h-4" />
                {homeTeamName}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setKoWinner(awayTeamId ?? "")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 transition-colors disabled:opacity-50",
                  koWinner && koWinner === awayTeamId
                    ? "bg-pitch text-cream ring-pitch"
                    : "bg-white text-ink ring-ink/15 hover:ring-gold",
                )}
              >
                <Flag emoji={awayFlag} code={awayCode} name={awayTeamName} className="h-4" />
                {awayTeamName}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs font-semibold text-ink/60">
            Pasa {home > away ? homeTeamName : awayTeamName}
          </p>
        ))}

      <div className="text-center text-xs text-ink/55">
        Cierra en <Countdown target={lockAt} />
      </div>

      {error && (
        <p className="text-center text-sm font-semibold text-cardred">{error}</p>
      )}
      {success && (
        <p className="text-center text-sm font-semibold text-grass">
          {success}
          {isAutoRandom && hasPick && " (sobrescribí el pick auto-random)"}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-full bg-pitch px-4 py-3 text-sm font-bold text-cream shadow-sm transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Guardando..." : hasPick ? "Actualizar pick" : "Guardar pick"}
      </button>

      <RelatorToast
        show={toast !== null}
        title={toast?.title ?? ""}
        sub={toast?.sub}
        onClose={() => setToast(null)}
      />
      {fechaDone !== null && (
        <FechaCompleta total={fechaDone} onClose={() => setFechaDone(null)} />
      )}
    </form>
  );
}
