"use client";

import { useEffect } from "react";

/**
 * Toast estilo "cartelito de transmisión": franja dorada + ⚽. Aparece arriba,
 * se va solo. Controlado por el padre (show + onClose).
 */
export function RelatorToast({
  show,
  title,
  sub,
  onClose,
  durationMs = 2600,
}: {
  show: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(onClose, durationMs);
    return () => clearTimeout(id);
  }, [show, durationMs, onClose]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-3 pt-3">
      <div className="pointer-events-auto flex w-full max-w-sm animate-[fade-up_.3s_ease] items-center gap-3 rounded-xl border-l-[6px] border-gold bg-cream p-3 text-ink shadow-card">
        <span aria-hidden className="text-2xl">
          ⚽
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-display text-base leading-none text-ink">
            {title}
          </div>
          {sub && <div className="mt-0.5 truncate text-[11px] text-ink/65">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
