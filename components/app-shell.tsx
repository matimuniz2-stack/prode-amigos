import { cn } from "@/lib/utils";

/**
 * Doodles tácticos de fondo (líneas de cancha, X y O, flechas, pelota).
 * Decorativo, fijo detrás del contenido, muy sutil.
 */
function PitchDoodles() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full text-cream/[0.055]"
      viewBox="0 0 400 820"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {/* Mediocampo */}
      <line x1="-20" y1="150" x2="420" y2="150" />
      <circle cx="200" cy="150" r="66" />
      <circle cx="200" cy="150" r="2.5" fill="currentColor" stroke="none" />
      {/* Jugadas: X y O */}
      <g strokeWidth={2.5}>
        <line x1="48" y1="300" x2="80" y2="332" />
        <line x1="80" y1="300" x2="48" y2="332" />
      </g>
      <circle cx="330" cy="330" r="18" strokeWidth={2.5} />
      <g strokeWidth={2.5}>
        <line x1="300" y1="600" x2="332" y2="632" />
        <line x1="332" y1="600" x2="300" y2="632" />
      </g>
      {/* Flecha de jugada */}
      <path d="M70 470 C 130 430, 190 520, 250 470" strokeWidth={2.5} />
      <path d="M250 470 l -14 -4 m 14 4 l -6 13" strokeWidth={2.5} />
      {/* Área inferior */}
      <rect x="120" y="760" width="160" height="80" rx="2" />
      <circle cx="200" cy="760" r="2.5" fill="currentColor" stroke="none" />
      {/* Pelota */}
      <g strokeWidth={2} transform="translate(86 660)">
        <circle r="20" />
        <path d="M0 -11 l 10 7 -4 12 -12 0 -4 -12 z" />
      </g>
    </svg>
  );
}

/**
 * Contenedor: en mobile, ancho tipo app (480px) con espacio para la
 * BottomNav. En desktop (md+), columna central más ancha y sin la nav
 * inferior (la navegación pasa a la TopNav).
 */
export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <PitchDoodles />
      <div
        className={cn(
          "mx-auto flex min-h-svh w-full max-w-[480px] flex-col gap-6 px-4 pb-28 pt-6 md:max-w-2xl md:px-6 md:pb-12",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
