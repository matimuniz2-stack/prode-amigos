"use client";

import { useEffect, useState } from "react";
import { ConfettiBurst } from "@/components/effects/confetti-burst";

/**
 * "Sobre de figus": cuando te ganás una insignia automática NUEVA (no la viste
 * antes), salta un toast tipo "¡abriste figurita!" con la medalla girando.
 * Guarda en localStorage las que ya viste; en el primer ingreso siembra sin
 * mostrar nada (solo dispara con insignias genuinamente nuevas).
 */
export function BadgeDrop({ badges }: { badges: string[] }) {
  const [show, setShow] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("seen-badges");
      // Primer ingreso: sembrar sin mostrar (no cargosear con lo que ya tenías).
      if (raw === null) {
        localStorage.setItem("seen-badges", JSON.stringify(badges));
        return;
      }
      const seen = JSON.parse(raw) as string[];
      const fresh = badges.filter((b) => !seen.includes(b));
      localStorage.setItem("seen-badges", JSON.stringify(badges));
      if (fresh.length > 0) setShow(fresh[0]);
    } catch {
      /* sin storage no mostramos para no repetir en cada carga */
    }
  }, [badges]);

  if (!show) return null;

  const emoji = show.split(" ")[0];
  const name = show.replace(/^[^\s]+\s/, "");

  return (
    <div
      role="dialog"
      aria-label="Insignia desbloqueada"
      onClick={() => setShow(null)}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6 animate-[fade-up_.3s_ease]"
    >
      <div className="relative w-full max-w-xs animate-pop overflow-hidden rounded-3xl bg-pitch p-7 text-center shadow-card ring-2 ring-gold/50">
        <ConfettiBurst count={44} />
        <div className="relative flex flex-col items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-gold">
            ✨ Insignia desbloqueada ✨
          </span>
          <span
            className="grid size-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#fff6cf,#FFD23F_55%,#c79e1f)] text-4xl shadow-[0_0_0_4px_#06281F,0_0_22px_rgba(255,210,63,.6)]"
            style={{ animation: "badge-reveal .8s ease both" }}
          >
            {emoji}
          </span>
          <span className="text-display text-2xl leading-none text-cream">
            {name}
          </span>
          <span className="text-xs font-semibold text-cream/60">
            ¡Abriste figurita! Tocá para cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
