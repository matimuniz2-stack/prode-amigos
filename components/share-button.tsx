"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Baja el PNG generado en `endpoint` y lo comparte con la Web Share API del
 * celu (manda el archivo directo a WhatsApp). Si el navegador no soporta
 * compartir archivos, lo descarga como fallback.
 */
export function ShareButton({
  endpoint,
  filename,
  label = "Compartir",
  text,
  className,
}: {
  endpoint: string;
  filename: string;
  label?: string;
  text?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function onClick() {
    setState("loading");
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      setState("idle");
    } catch (err) {
      // El usuario cancelando el share no es un error que valga mostrar.
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("idle");
        return;
      }
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-ink shadow-card transition active:scale-95 disabled:opacity-60",
        className,
      )}
    >
      {state === "loading" ? "Generando…" : state === "error" ? "Error, reintentá" : `📲 ${label}`}
    </button>
  );
}
