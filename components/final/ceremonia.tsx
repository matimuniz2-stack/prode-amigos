"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CrownedAvatar } from "@/components/crowned-avatar";
import { ConfettiBurst } from "@/components/effects/confetti-burst";
import { cn } from "@/lib/utils";
import type { FinalPlayer } from "@/lib/final";

/**
 * La ceremonia de premiación: arranca con el telón, redoble, y el podio se
 * arma de a uno (3° → 2° → campeón) con confeti dorado. Todo es una secuencia
 * de estados con timeouts; se puede repetir las veces que quieras.
 */

type Step = "idle" | "drum" | "third" | "second" | "drumFinal" | "champ";

const SEQUENCE: { step: Step; ms: number }[] = [
  { step: "drum", ms: 2200 },
  { step: "third", ms: 2600 },
  { step: "second", ms: 2600 },
  { step: "drumFinal", ms: 2800 },
  { step: "champ", ms: 0 },
];

const ORDER: Record<Step, number> = {
  idle: 0,
  drum: 1,
  third: 2,
  second: 3,
  drumFinal: 4,
  champ: 5,
};

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

// Meta por puesto (índice 0 = 1°, 1 = 2°, 2 = 3°), espejo del ranking.
const PODIUM = [
  { bar: "h-24 bg-gradient-to-b from-gold to-amber-500", ring: "ring-gold", medal: "🥇" },
  { bar: "h-16 bg-gradient-to-b from-slate-200 to-slate-400", ring: "ring-slate-300", medal: "🥈" },
  { bar: "h-11 bg-gradient-to-b from-amber-600 to-amber-800", ring: "ring-amber-600", medal: "🥉" },
];

function PodiumSpot({
  player,
  idx,
  revealed,
  currency,
}: {
  player: FinalPlayer | undefined;
  idx: number;
  revealed: boolean;
  currency: string;
}) {
  if (!player) return null;
  const m = PODIUM[idx];
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-1 transition-all duration-700",
        revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      {idx === 0 ? (
        <>
          <span className={cn("text-3xl", revealed && "animate-bounce")}>🏆</span>
          <CrownedAvatar
            crowned
            src={player.avatarUrl}
            name={player.nickname}
            className={cn("size-20 text-3xl ring-4", m.ring)}
          />
        </>
      ) : (
        <Avatar
          src={player.avatarUrl}
          name={player.nickname}
          className={cn("size-14 text-xl ring-2", m.ring)}
        />
      )}
      <span
        className={cn(
          "max-w-full truncate font-bold text-cream",
          idx === 0 ? "text-lg" : "text-sm",
        )}
      >
        {player.nickname}
      </span>
      <span
        className={cn(
          "text-xs font-extrabold tabular-nums",
          idx === 0 ? "text-gold" : "text-cream/70",
        )}
      >
        {player.points} pts
      </span>
      {player.prize > 0 && (
        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-black text-gold">
          {money(player.prize, currency)}
        </span>
      )}
      <div
        className={cn(
          "flex w-full items-start justify-center rounded-t-xl pt-1.5 text-2xl font-black text-ink/80",
          m.bar,
        )}
      >
        {m.medal}
      </div>
    </div>
  );
}

export function Ceremonia({
  podium,
  last,
  currency,
}: {
  podium: FinalPlayer[];
  last: FinalPlayer | null;
  currency: string;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (run === 0) return;
    setStep("idle");
    let acc = 250;
    const ids = SEQUENCE.map(({ step: s, ms }) => {
      const id = setTimeout(() => setStep(s), acc);
      acc += ms;
      return id;
    });
    return () => ids.forEach(clearTimeout);
  }, [run]);

  const at = ORDER[step];
  const drumming = step === "drum" || step === "drumFinal";

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_0%,#0f7a4d,#06281F_75%)] p-5 shadow-card ring-1 ring-cream/10">
      {(step === "third" || step === "second") && <ConfettiBurst count={24} />}
      {step === "champ" && <ConfettiBurst count={90} durationMs={4500} />}

      <div className="text-center">
        <div className="text-display text-2xl tracking-wide text-gold">
          🎉 LA CEREMONIA 🎉
        </div>
        <p className="mt-1 text-xs font-semibold text-cream/60">
          Se terminó el Mundial — el podio del prode, de una vez y para siempre
        </p>
      </div>

      {step === "idle" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-5xl">🎭</span>
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="rounded-full bg-gold px-6 py-3 text-sm font-black text-ink shadow-card transition active:scale-95"
          >
            🥁 Que empiece la ceremonia
          </button>
        </div>
      )}

      {drumming && (
        <div className="flex flex-col items-center gap-2 py-10">
          <span className="animate-pulse text-5xl">🥁</span>
          <p className="animate-pulse text-sm font-extrabold text-cream">
            {step === "drum"
              ? "redoble de tambores…"
              : "y el CAMPEÓN del prode es…"}
          </p>
        </div>
      )}

      {at >= 2 && !drumming && (
        <div className="mt-5 flex items-end justify-center gap-3">
          <PodiumSpot
            player={podium[1]}
            idx={1}
            revealed={at >= 3}
            currency={currency}
          />
          <PodiumSpot
            player={podium[0]}
            idx={0}
            revealed={at >= 5}
            currency={currency}
          />
          <PodiumSpot
            player={podium[2]}
            idx={2}
            revealed={at >= 2}
            currency={currency}
          />
        </div>
      )}

      {step === "champ" && (
        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-black text-gold">
            👑 {podium[0]?.nickname} — CAMPEÓN DEL PRODE 👑
          </p>
          {last && (
            <p className="text-xs font-semibold text-cream/60">
              🤡 Y un aplauso para la mufa: {last.nickname}, último con{" "}
              {last.points} pts. Campeón moral, eso sí.
            </p>
          )}
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="mt-1 rounded-full bg-cream/10 px-4 py-2 text-xs font-bold text-cream/80 transition hover:bg-cream/20 active:scale-95"
          >
            🔁 Verla de nuevo
          </button>
        </div>
      )}
    </section>
  );
}
