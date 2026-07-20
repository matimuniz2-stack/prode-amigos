"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Igual que ShareButton pero para el MP4 de la película: lo baja y lo manda
 * con la Web Share API (directo a WhatsApp). Si el navegador no banca
 * compartir archivos, lo descarga.
 */
export function ShareVideo({
  src,
  filename,
  text,
  className,
}: {
  src: string;
  filename: string;
  text?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function onClick() {
    setState("loading");
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "video/mp4" });

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
      {state === "loading"
        ? "Bajando…"
        : state === "error"
          ? "Error, reintentá"
          : "📲 Mandar al grupo"}
    </button>
  );
}
