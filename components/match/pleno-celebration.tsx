"use client";

import { useEffect, useState } from "react";
import { ConfettiBurst } from "@/components/effects/confetti-burst";

/**
 * "¡LA CLAVASTE!": festejo cuando clavaste el resultado exacto (pleno) de un
 * partido terminado. Salta una sola vez por partido (localStorage) para no
 * cargosear en cada visita. Se cierra tocando o solo a los pocos segundos.
 */
export function PlenoCelebration({
  matchId,
  points,
  scoreLabel,
}: {
  matchId: string;
  points: number;
  scoreLabel: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `pleno-celebrated-${matchId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // sin storage igual lo mostramos una vez por montaje
    }
    setShow(true);
    const id = setTimeout(() => setShow(false), 5200);
    return () => clearTimeout(id);
  }, [matchId]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Clavaste el resultado"
      onClick={() => setShow(false)}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6 animate-[fade-up_.3s_ease]"
    >
      <div className="relative w-full max-w-xs animate-pop overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_35%,#0f7a4d,#06281F)] p-7 text-center shadow-card ring-2 ring-gold/50">
        <ConfettiBurst count={48} />
        <div className="relative">
          <div className="mb-1 text-3xl">⚽🎉</div>
          <div
            className="text-display text-4xl leading-none text-gold drop-shadow-[0_2px_0_#06281F]"
            style={{ transform: "rotate(-4deg)" }}
          >
            ¡LA CLAVASTE!
          </div>
          <div className="mt-4 inline-block rounded-full bg-gold px-4 py-1.5 text-sm font-extrabold text-ink">
            {scoreLabel} ✓ PLENO +{points}
          </div>
          <div className="mt-4 text-xs font-semibold text-cream/70">
            Clavaste el resultado exacto, crack 😎 — tocá para cerrar
          </div>
        </div>
      </div>
    </div>
  );
}
