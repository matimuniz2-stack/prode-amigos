import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";

/**
 * Avatar con coronación: si `crowned`, le pone una 👑 flotando arriba y un aura
 * dorada que late. Si no, es un Avatar normal. Para el líder del ranking.
 */
export function CrownedAvatar({
  src,
  name,
  className,
  crowned,
}: {
  src?: string | null;
  name: string;
  className?: string;
  crowned?: boolean;
}) {
  if (!crowned) {
    return <Avatar src={src} name={name} className={className} />;
  }
  return (
    <span className="relative inline-flex">
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 animate-pulse rounded-full ring-2 ring-gold/70"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-lg"
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.45))" }}
      >
        👑
      </span>
      <Avatar src={src} name={name} className={cn("ring-2 ring-gold", className)} />
    </span>
  );
}
