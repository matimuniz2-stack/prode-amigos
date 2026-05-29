"use client";

import { useState, useTransition } from "react";
import {
  recalcMatch,
  setMatchResult,
} from "@/app/(authed)/admin/results/actions";
import { cn } from "@/lib/utils";

interface Props {
  matchId: string;
  meta: string;
  homeName: string;
  awayName: string;
  homeFlag: string | null;
  awayFlag: string | null;
  homeTeamId: string;
  awayTeamId: string;
  isKO: boolean;
  initialHome: number | null;
  initialAway: number | null;
  initialKoWinner: string | null;
  finished: boolean;
}

function ScoreInput({
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
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={ariaLabel}
      disabled={disabled}
      value={String(value)}
      maxLength={2}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? 0 : Math.min(20, parseInt(digits, 10)));
      }}
      className="size-12 rounded-xl border-2 border-ink/15 bg-white text-center text-2xl font-black tabular-nums text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
    />
  );
}

export function AdminResultRow(props: Props) {
  const [home, setHome] = useState(props.initialHome ?? 0);
  const [away, setAway] = useState(props.initialAway ?? 0);
  const [ko, setKo] = useState(props.initialKoWinner ?? "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // En KO, sugerimos el ganador según el score (editable por penales/alargue).
  const suggestedKo =
    home > away ? props.homeTeamId : away > home ? props.awayTeamId : "";
  const koValue = ko || suggestedKo;

  const submit = (finalize: boolean) => {
    setMsg(null);
    startTransition(async () => {
      const res = await setMatchResult({
        matchId: props.matchId,
        scoreHome: home,
        scoreAway: away,
        koWinnerTeamId: props.isKO ? koValue || null : null,
        finalize,
        reason,
      });
      setMsg(
        res.ok
          ? { type: "ok", text: finalize ? "Finalizado y puntuado ✓" : "Guardado ✓" }
          : { type: "err", text: res.error },
      );
    });
  };

  const recalc = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await recalcMatch(props.matchId, reason);
      setMsg(
        res.ok
          ? { type: "ok", text: "Recalculado ✓" }
          : { type: "err", text: res.error },
      );
    });
  };

  return (
    <div className="rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink/50">
        <span className="truncate">{props.meta}</span>
        {props.finished && (
          <span className="shrink-0 rounded-full bg-grass/15 px-2 py-0.5 text-grass">
            Finalizado
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-2xl leading-none">
            {props.homeFlag ?? "🏳️"}
          </span>
          <span className="truncate font-bold">{props.homeName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ScoreInput
            value={home}
            onChange={setHome}
            disabled={isPending}
            ariaLabel={`Goles de ${props.homeName}`}
          />
          <span className="text-xl font-black text-ink/40">-</span>
          <ScoreInput
            value={away}
            onChange={setAway}
            disabled={isPending}
            ariaLabel={`Goles de ${props.awayName}`}
          />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right font-bold">{props.awayName}</span>
          <span aria-hidden className="text-2xl leading-none">
            {props.awayFlag ?? "🏳️"}
          </span>
        </div>
      </div>

      {props.isKO && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-ink/60">
            Ganador (si hubo penales/alargue)
          </label>
          <select
            value={koValue}
            onChange={(e) => setKo(e.target.value)}
            disabled={isPending}
            className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2 font-medium text-ink outline-none focus:border-gold disabled:opacity-50"
          >
            <option value="">— elegir —</option>
            <option value={props.homeTeamId}>{props.homeName}</option>
            <option value={props.awayTeamId}>{props.awayName}</option>
          </select>
        </div>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (opcional, queda en auditoría)"
        disabled={isPending}
        className="mt-3 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold disabled:opacity-50"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={isPending}
          className="flex-1 rounded-full bg-pitch px-4 py-2.5 text-sm font-bold text-cream transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
        >
          {isPending
            ? "..."
            : props.finished
              ? "Re-finalizar"
              : "Finalizar y puntuar"}
        </button>
        {props.finished ? (
          <button
            type="button"
            onClick={recalc}
            disabled={isPending}
            className="rounded-full bg-ink/10 px-4 py-2.5 text-sm font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Recalcular
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={isPending}
            className="rounded-full bg-ink/10 px-4 py-2.5 text-sm font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Guardar
          </button>
        )}
      </div>

      {msg && (
        <p
          className={cn(
            "mt-2 text-center text-xs font-semibold",
            msg.type === "ok" ? "text-grass" : "text-cardred",
          )}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
