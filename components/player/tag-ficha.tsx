"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TAG_TONE_CLASS, toneForTag, descForTag } from "@/lib/tags";

/**
 * Chip de insignia tappable: al tocarlo se abre su ficha (qué significa / de
 * qué se gana). Pensado para el perfil del jugador (no va dentro de un Link).
 */
export function TagFicha({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const tone = toneForTag(label);
  const emoji = label.split(" ")[0];
  const name = label.replace(/^[^\s]+\s/, "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver qué significa"
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold transition active:scale-95",
          TAG_TONE_CLASS[tone],
        )}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={name}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6 animate-[fade-up_.3s_ease]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs animate-pop rounded-3xl bg-cream p-6 text-center text-ink shadow-card"
          >
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#fff6cf,#FFD23F_55%,#c79e1f)] text-3xl shadow-[0_0_0_4px_#06281F]">
              {emoji}
            </div>
            <div className="text-display mt-3 text-2xl leading-none">{name}</div>
            <span
              className={cn(
                "mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                TAG_TONE_CLASS[tone],
              )}
            >
              {label}
            </span>
            <p className="mt-3 text-sm text-ink/70">{descForTag(label)}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-full bg-pitch px-4 py-1.5 text-xs font-bold text-cream transition active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
