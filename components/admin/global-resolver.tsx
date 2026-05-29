"use client";

import { useState, useTransition } from "react";
import { resolveGlobalCategory } from "@/app/(authed)/admin/globales/actions";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  flag_emoji: string | null;
}
interface Variant {
  name: string;
  count: number;
}

const field =
  "w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 font-medium text-ink outline-none transition-colors focus:border-gold disabled:opacity-50";

export function GlobalResolver({
  category,
  label,
  type,
  teams,
  variants,
}: {
  category: string;
  label: string;
  type: "team" | "player";
  teams: Team[];
  variants: Variant[];
}) {
  const [team, setTeam] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await resolveGlobalCategory({
        category,
        teamId: team,
        playerName: type === "player" ? name : null,
        reason,
      });
      setMsg(
        res.ok
          ? { type: "ok", text: `Resuelto · ${res.awarded} acierto(s)` }
          : { type: "err", text: res.error },
      );
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5"
    >
      <label className="text-sm font-extrabold">{label}</label>
      <select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        disabled={isPending}
        className={field}
      >
        <option value="">
          — equipo {type === "player" ? "del jugador" : "ganador"} —
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.flag_emoji ? `${t.flag_emoji} ` : ""}
            {t.name}
          </option>
        ))}
      </select>

      {type === "player" && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            placeholder="Nombre del jugador"
            className={field}
          />
          {variants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink/50">Cargaron:</span>
              {variants.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setName(v.name)}
                  className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/10"
                >
                  {v.name} ({v.count})
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={isPending}
        placeholder="Motivo (opcional)"
        className={cn(field, "text-sm")}
      />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-pitch px-4 py-2.5 text-sm font-bold text-cream transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "..." : "Resolver y puntuar"}
      </button>

      {msg && (
        <p
          className={cn(
            "text-xs font-semibold",
            msg.type === "ok" ? "text-grass" : "text-cardred",
          )}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}
