"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { TAG_TONE_CLASS, toneForTag } from "@/lib/tags";
import { setFeaturedTag } from "@/app/(authed)/mi-prode/actions";

/**
 * Picker de insignia destacada: elegís uno de tus tags para chapear al lado
 * del nombre en el ranking. Tocar el activo lo saca.
 */
export function FeaturedTagPicker({
  tags,
  initial,
}: {
  tags: string[];
  initial: string | null;
}) {
  const [featured, setFeatured] = useState<string | null>(initial);
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function choose(tag: string | null) {
    setErr(null);
    start(async () => {
      const res = await setFeaturedTag(tag);
      if (res.ok) setFeatured(tag);
      else setErr(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <span className="text-sm font-extrabold">🎖️ Tu insignia destacada</span>
      <p className="text-xs text-ink/55">
        Elegí una para chapearla al lado de tu nombre en el ranking.
      </p>
      {tags.length === 0 ? (
        <p className="text-xs text-ink/50">
          Todavía no tenés insignias. Ganá alguna jugando 😉
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = featured === t;
            return (
              <button
                key={t}
                type="button"
                disabled={isPending}
                onClick={() => choose(active ? null : t)}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-50",
                  TAG_TONE_CLASS[toneForTag(t)],
                  active && "ring-2 ring-pitch ring-offset-1",
                )}
              >
                {active && "✓ "}
                {t}
              </button>
            );
          })}
        </div>
      )}
      {err && <p className="text-xs font-semibold text-cardred">{err}</p>}
    </div>
  );
}
