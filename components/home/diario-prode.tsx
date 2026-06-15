"use client";

import { useState } from "react";

/**
 * Botón para copiar la crónica de la fecha y pegarla en WhatsApp.
 * El texto se arma en el server (lib/diario.ts) y se pasa como prop.
 */
export function DiarioProde({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: seleccionar el texto para copiar a mano.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
          📰 El Diario del Prode
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-pitch px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95"
        >
          {copied ? "✅ ¡Copiado!" : "📋 Copiar para WhatsApp"}
        </button>
      </div>
      <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-3 font-sans text-xs leading-relaxed text-ink/80">
        {text}
      </pre>
    </div>
  );
}
