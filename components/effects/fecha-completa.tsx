"use client";

import { useEffect } from "react";
import { ConfettiBurst } from "@/components/effects/confetti-burst";

/**
 * Confirmación "todo listo": check verde + confeti cuando terminás de cargar
 * TODOS los picks abiertos. Controlado por el padre (se muestra cuando total != null).
 */
export function FechaCompleta({
  total,
  onClose,
}: {
  total: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Fecha completa"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6 animate-[fade-up_.3s_ease]"
    >
      <div className="relative w-full max-w-xs animate-pop overflow-hidden rounded-3xl bg-cream p-7 text-center shadow-card">
        <ConfettiBurst count={46} />
        <div className="relative">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-grass text-3xl font-black text-white shadow-card">
            ✓
          </div>
          <div className="text-display mt-3 text-3xl leading-none text-ink">
            ¡FECHA COMPLETA!
          </div>
          <p className="mt-2 text-sm text-ink/70">
            Clavaste {total === 1 ? "el partido" : <>los <b>{total} partidos</b></>}.
            Ahora a rezar 🙏
          </p>
          <div className="mt-3 text-xs font-semibold text-ink/50">
            Tocá para cerrar
          </div>
        </div>
      </div>
    </div>
  );
}
