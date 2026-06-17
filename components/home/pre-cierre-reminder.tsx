"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Countdown } from "@/components/countdown";

/**
 * Recordatorio flotante: si te faltan picks y todavía no cerró, salta un toast
 * abajo con la cuenta regresiva y un botón directo a cargar. Se puede cerrar
 * (queda silenciado esta sesión para ese cierre).
 */
export function PreCierreReminder({
  missingCount,
  nextLock,
  href = "/matches",
}: {
  missingCount: number;
  nextLock: string;
  href?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (missingCount <= 0) return;
    if (new Date(nextLock).getTime() <= Date.now()) return;
    try {
      if (sessionStorage.getItem(`precierre-dismissed-${nextLock}`)) return;
    } catch {
      // sin storage igual lo mostramos
    }
    setOpen(true);
  }, [missingCount, nextLock]);

  if (!open || missingCount <= 0) return null;

  const close = () => {
    try {
      sessionStorage.setItem(`precierre-dismissed-${nextLock}`, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <div className="pointer-events-auto w-full max-w-sm animate-[fade-up_.35s_ease] rounded-2xl border-l-4 border-gold bg-ink p-3 text-cream shadow-card">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            ⏰
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-extrabold text-gold">
              Te faltan {missingCount} pick{missingCount === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] text-cream/75">
              Cierra en{" "}
              <Countdown target={nextLock} className="font-bold text-cream" />.
              Si no cargás, va random 🎲
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar recordatorio"
            className="shrink-0 px-1 text-cream/50 transition hover:text-cream"
          >
            ✕
          </button>
        </div>
        <Link
          href={href}
          onClick={close}
          className="mt-2.5 block rounded-full bg-grass py-2 text-center text-sm font-bold text-white transition active:scale-95"
        >
          Cargar ahora →
        </Link>
      </div>
    </div>
  );
}
