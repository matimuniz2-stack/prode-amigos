import { cn } from "@/lib/utils";
import { flagCode, flagUrl } from "@/lib/flags";

/**
 * Bandera de un país como imagen (se ve igual en Windows/iOS/Android).
 * Si no se puede derivar el código (caso raro), cae al emoji.
 * El tamaño se controla con className (default h-5 w-auto; pasá h-6, etc.).
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
  if (!a2) {
    return (
      <span className={cn("inline-block leading-none", className)} aria-hidden>
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
      loading="lazy"
      className={cn(
        "inline-block h-5 w-auto rounded-[2px] align-middle shadow-sm ring-1 ring-black/5",
        className,
      )}
    />
  );
}
