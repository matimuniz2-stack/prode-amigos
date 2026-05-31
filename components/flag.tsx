"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { flagCode, flagUrl } from "@/lib/flags";

/**
 * Bandera de un país como imagen (se ve igual en Windows/iOS/Android).
 * - Reserva el espacio (aspect-ratio + width/height) para no causar saltos
 *   de layout (CLS) mientras carga.
 * - Si no se puede derivar el código, o si la imagen falla (CDN caído / sin
 *   conexión), cae al emoji.
 * El tamaño se controla con className (default h-5; pasá h-6, etc.).
 */
export function Flag({
  emoji,
  code,
  name,
  className,
}: {
  emoji?: string | null;
  code?: string | null;
  name?: string | null;
  className?: string;
}) {
  const a2 = flagCode(emoji, code);
  const [failed, setFailed] = useState(false);

  if (!a2 || failed) {
    return (
      <span
        className={cn("inline-block h-5 leading-none", className)}
        aria-hidden
      >
        {emoji ?? "🏳️"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- bandera estática de CDN, next/image es innecesario
    <img
      src={flagUrl(a2, 60)}
      srcSet={`${flagUrl(a2, 120)} 2x`}
      alt={name ? `Bandera de ${name}` : ""}
      width={45}
      height={30}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "inline-block aspect-[3/2] h-5 w-auto rounded-[2px] object-cover align-middle shadow-sm ring-1 ring-black/5",
        className,
      )}
    />
  );
}
