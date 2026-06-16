import { cn } from "@/lib/utils";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Avatar del jugador: muestra la foto (avatar_url) o, si no tiene, la inicial
 * en un círculo. El tamaño/ring se controlan con `className` (ej. "size-11").
 */
export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const base = "shrink-0 rounded-full";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={cn(base, "bg-ink/10 object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        base,
        "grid place-items-center bg-ink/10 font-black text-ink/70",
        className,
      )}
    >
      {initial(name)}
    </span>
  );
}
