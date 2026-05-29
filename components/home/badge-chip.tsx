import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/demo-data";

const TONES: Record<BadgeTone, string> = {
  gold: "border-gold/60 bg-gold/10 text-gold",
  grass: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300",
  red: "border-cardred/60 bg-cardred/15 text-red-300",
  sky: "border-sky-400/60 bg-sky-400/10 text-sky-300",
};

/** Chip de logro (puede ir en un carrusel horizontal). */
export function BadgeChip({
  emoji,
  label,
  tone,
}: {
  emoji: string;
  label: string;
  tone: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold backdrop-blur transition-transform active:scale-95",
        TONES[tone],
      )}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}
