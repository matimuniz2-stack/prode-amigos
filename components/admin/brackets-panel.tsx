"use client";

import { useState, useTransition } from "react";
import {
  assignThirds,
  runResolveBrackets,
} from "@/app/(authed)/admin/brackets/actions";
import { cn } from "@/lib/utils";

export interface ThirdTeam {
  teamId: string;
  name: string;
  flag: string | null;
  group: string;
  pts: number;
}

export interface Slot {
  matchNumber: number;
  home: string;
  allowed: string[];
  currentThird: string | null;
}

type Msg = { type: "ok" | "err"; text: string } | null;

export function BracketsPanel({
  completedCount,
  allComplete,
  best8,
  slots,
}: {
  completedCount: number;
  allComplete: boolean;
  best8: ThirdTeam[];
  slots: Slot[];
}) {
  const [resolveMsg, setResolveMsg] = useState<Msg>(null);
  const [thirdsMsg, setThirdsMsg] = useState<Msg>(null);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [isResolving, startResolve] = useTransition();
  const [isAssigning, startAssign] = useTransition();

  const resolve = () => {
    setResolveMsg(null);
    startResolve(async () => {
      const res = await runResolveBrackets("Resolver cruces (admin)");
      setResolveMsg(
        res.ok
          ? { type: "ok", text: res.msg }
          : { type: "err", text: res.error },
      );
    });
  };

  const confirmThirds = () => {
    setThirdsMsg(null);
    const assignments = slots.map((s) => ({
      matchNumber: s.matchNumber,
      teamId: picks[s.matchNumber] ?? "",
    }));
    startAssign(async () => {
      const res = await assignThirds(assignments, "Asignación de terceros (admin)");
      setThirdsMsg(
        res.ok
          ? { type: "ok", text: res.msg }
          : { type: "err", text: res.error },
      );
    });
  };

  const msgClass = (m: Msg) =>
    cn(
      "text-sm font-semibold",
      m?.type === "ok" ? "text-grass" : "text-cardred",
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Resolver cruces */}
      <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <div>
          <h3 className="font-extrabold">Resolver cruces</h3>
          <p className="text-sm text-ink/60">
            Llena los 1º/2º de cada grupo terminado y hace avanzar a los
            ganadores. Correlo cada vez que termina una ronda.
          </p>
        </div>
        <button
          type="button"
          onClick={resolve}
          disabled={isResolving}
          className="w-full rounded-full bg-pitch px-4 py-3 text-sm font-bold text-cream transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
        >
          {isResolving ? "Resolviendo..." : "Resolver cruces ahora"}
        </button>
        {resolveMsg && <p className={msgClass(resolveMsg)}>{resolveMsg.text}</p>}
      </div>

      {/* Terceros */}
      <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <div>
          <h3 className="font-extrabold">Mejores terceros</h3>
          <p className="text-sm text-ink/60">
            Grupos terminados: {completedCount}/12.{" "}
            {allComplete
              ? "Asigná cada tercero a su llave (comparalo con la tabla oficial FIFA) y confirmá."
              : "Cuando terminen los 12 grupos vas a poder asignar los 8 mejores terceros."}
          </p>
        </div>

        {allComplete && (
          <>
            <div className="rounded-xl bg-pitch/5 p-3 text-sm">
              <span className="font-bold">8 mejores terceros: </span>
              {best8
                .map((t) => `${t.flag ?? ""} ${t.name} (${t.group}, ${t.pts}pts)`)
                .join(" · ")}
            </div>

            <div className="flex flex-col gap-2.5">
              {slots.map((s) => {
                const eligibles = best8.filter((t) => s.allowed.includes(t.group));
                return (
                  <div
                    key={s.matchNumber}
                    className="flex flex-col gap-1 border-b border-ink/5 pb-2.5 last:border-b-0"
                  >
                    <span className="text-xs font-semibold text-ink/60">
                      Partido {s.matchNumber} · {s.home} vs 3º (de{" "}
                      {s.allowed.join("/")})
                      {s.currentThird && (
                        <span className="ml-1 text-grass">
                          → {s.currentThird}
                        </span>
                      )}
                    </span>
                    <select
                      value={picks[s.matchNumber] ?? ""}
                      onChange={(e) =>
                        setPicks((p) => ({
                          ...p,
                          [s.matchNumber]: e.target.value,
                        }))
                      }
                      disabled={isAssigning}
                      className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2 font-medium text-ink outline-none focus:border-gold disabled:opacity-50"
                    >
                      <option value="">— elegir tercero —</option>
                      {eligibles.map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          {t.flag ? `${t.flag} ` : ""}
                          {t.name} (grupo {t.group})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={confirmThirds}
              disabled={isAssigning}
              className="w-full rounded-full bg-pitch px-4 py-3 text-sm font-bold text-cream transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
            >
              {isAssigning ? "Asignando..." : "Asignar terceros y abrir cruces"}
            </button>
            {thirdsMsg && <p className={msgClass(thirdsMsg)}>{thirdsMsg.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}
