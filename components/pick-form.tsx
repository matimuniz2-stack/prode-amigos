"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/countdown";
import { submitPick } from "@/app/(authed)/matches/[matchId]/actions";
import { cn } from "@/lib/utils";

interface PickFormProps {
  matchId: string;
  lockAt: string;
  homeTeamName: string;
  awayTeamName: string;
  homeFlag: string | null;
  awayFlag: string | null;
  initialHome: number;
  initialAway: number;
  hasPick: boolean;
  isAutoRandom: boolean;
}

function Stepper({
  label,
  value,
  setValue,
  disabled,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setValue(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          aria-label={`Restar gol a ${label}`}
        >
          −
        </Button>
        <span className="w-12 text-center text-3xl font-bold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setValue(Math.min(20, value + 1))}
          disabled={disabled || value >= 20}
          aria-label={`Sumar gol a ${label}`}
        >
          +
        </Button>
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
  initialHome,
  initialAway,
  hasPick,
  isAutoRandom,
}: PickFormProps) {
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lockedClient, setLockedClient] = useState(false);

  const winnerLabel =
    home > away ? `Gana ${homeTeamName}` : home < away ? `Gana ${awayTeamName}` : "Empate";

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
        setSuccess(hasPick ? "Pick actualizado." : "Pick cargado.");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-around gap-2">
        <Stepper
          label={`${homeFlag ?? "🏳️"} ${homeTeamName}`}
          value={home}
          setValue={setHome}
          disabled={disabled}
        />
        <span className="text-2xl text-muted-foreground">-</span>
        <Stepper
          label={`${awayFlag ?? "🏳️"} ${awayTeamName}`}
          value={away}
          setValue={setAway}
          disabled={disabled}
        />
      </div>

      <p className={cn("text-center text-sm font-medium")}>{winnerLabel}</p>

      <div className="text-center text-xs text-muted-foreground">
        Cierra en <Countdown target={lockAt} />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center">
          {success}
          {isAutoRandom && hasPick && " (sobrescribí el pick auto-random)"}
        </p>
      )}

      <Button type="submit" size="lg" disabled={disabled} className="w-full">
        {isPending ? "Guardando..." : hasPick ? "Actualizar pick" : "Guardar pick"}
      </Button>
    </form>
  );
}
