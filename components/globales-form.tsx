"use client";

import { useState, useTransition } from "react";
import { submitGlobals } from "@/app/(authed)/globales/actions";

export interface GlobalsInput {
  champion: string;
  runner_up: string;
  top_scorer_team: string;
  top_scorer_name: string;
  mvp_team: string;
  mvp_name: string;
  revelation_team: string;
  revelation_name: string;
}

interface Team {
  id: string;
  name: string;
  flag_emoji: string | null;
}

function TeamSelect({
  teams,
  value,
  onChange,
  disabled,
}: {
  teams: Team[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 font-medium text-ink outline-none transition-colors focus:border-gold disabled:opacity-60"
    >
      <option value="">Elegí un equipo…</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.flag_emoji ? `${t.flag_emoji} ` : ""}
          {t.name}
        </option>
      ))}
    </select>
  );
}

function CategoryCard({
  emoji,
  label,
  random = false,
  children,
}: {
  emoji: string;
  label: string;
  random?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <label className="flex items-center gap-2 text-sm font-extrabold">
        <span>
          {emoji} {label}
        </span>
        {random && (
          <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            🎲 random
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

interface RandomFlags {
  champion: boolean;
  runner_up: boolean;
  top_scorer: boolean;
  mvp: boolean;
  revelation: boolean;
}

export function GlobalesForm({
  teams,
  initial,
  locked,
  random,
}: {
  teams: Team[];
  initial: GlobalsInput;
  locked: boolean;
  random?: RandomFlags;
}) {
  const [v, setV] = useState<GlobalsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (k: keyof GlobalsInput, val: string) =>
    setV((s) => ({ ...s, [k]: val }));
  const disabled = locked || isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await submitGlobals(v);
      if (res.ok) setSuccess("¡Globales guardados!");
      else setError(res.error);
    });
  };

  const nameInput =
    "w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 font-medium text-ink outline-none transition-colors focus:border-gold disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <CategoryCard emoji="🏆" label="Campeón" random={random?.champion}>
        <TeamSelect
          teams={teams}
          value={v.champion}
          onChange={(x) => set("champion", x)}
          disabled={disabled}
        />
      </CategoryCard>

      <CategoryCard emoji="🥈" label="Subcampeón" random={random?.runner_up}>
        <TeamSelect
          teams={teams}
          value={v.runner_up}
          onChange={(x) => set("runner_up", x)}
          disabled={disabled}
        />
      </CategoryCard>

      <CategoryCard emoji="👟" label="Goleador" random={random?.top_scorer}>
        <TeamSelect
          teams={teams}
          value={v.top_scorer_team}
          onChange={(x) => set("top_scorer_team", x)}
          disabled={disabled}
        />
        <input
          type="text"
          value={v.top_scorer_name}
          onChange={(e) => set("top_scorer_name", e.target.value)}
          disabled={disabled}
          placeholder="Nombre del jugador"
          className={nameInput}
        />
      </CategoryCard>

      <CategoryCard emoji="⭐" label="Mejor jugador (MVP)" random={random?.mvp}>
        <TeamSelect
          teams={teams}
          value={v.mvp_team}
          onChange={(x) => set("mvp_team", x)}
          disabled={disabled}
        />
        <input
          type="text"
          value={v.mvp_name}
          onChange={(e) => set("mvp_name", e.target.value)}
          disabled={disabled}
          placeholder="Nombre del jugador"
          className={nameInput}
        />
      </CategoryCard>

      <CategoryCard emoji="🌟" label="Revelación" random={random?.revelation}>
        <TeamSelect
          teams={teams}
          value={v.revelation_team}
          onChange={(x) => set("revelation_team", x)}
          disabled={disabled}
        />
        <input
          type="text"
          value={v.revelation_name}
          onChange={(e) => set("revelation_name", e.target.value)}
          disabled={disabled}
          placeholder="Nombre del jugador"
          className={nameInput}
        />
      </CategoryCard>

      {error && (
        <p className="text-center text-sm font-semibold text-cardred">{error}</p>
      )}
      {success && (
        <p className="text-center text-sm font-semibold text-grass">{success}</p>
      )}

      {!locked && (
        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-full bg-pitch px-4 py-3 text-sm font-bold text-cream shadow-sm transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar globales"}
        </button>
      )}
    </form>
  );
}
