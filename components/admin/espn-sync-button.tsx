"use client";

import { useState, useTransition } from "react";
import { pollEspnNow } from "@/app/(authed)/admin/results/actions";

export function EspnSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await pollEspnNow();
      if (!res.ok) {
        setMessage(`⚠️ ${res.error}`);
        return;
      }
      const { live, updated, finalized } = res.summary;
      if (live === 0) {
        setMessage("No hay partidos en vivo ahora.");
      } else {
        setMessage(
          `${live} en vivo · ${updated} actualizado${updated === 1 ? "" : "s"} · ${finalized} finalizado${finalized === 1 ? "" : "s"}`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-ink shadow-card transition-transform active:scale-95 disabled:opacity-60"
      >
        {isPending ? "Buscando..." : "⚡ Actualizar desde ESPN"}
      </button>
      {message && <p className="text-xs text-cream/70">{message}</p>}
    </div>
  );
}
