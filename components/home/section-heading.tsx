import { cn } from "@/lib/utils";

/** Título de sección con subrayado amarillo, estilo póster. */
export function SectionHeading({
  children,
  className,
  id,
  tag,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  tag?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "flex flex-wrap items-end gap-2 text-display text-2xl text-cream",
        className,
      )}
    >
      <span className="relative inline-block">
        {children}
        <span
          aria-hidden
          className="absolute -bottom-1.5 left-0 h-[3px] w-full rounded-full bg-gold"
        />
      </span>
      {tag && (
        <span className="pb-0.5 font-sans text-[10px] font-semibold normal-case tracking-wide text-cream/40">
          {tag}
        </span>
      )}
    </h2>
  );
}
