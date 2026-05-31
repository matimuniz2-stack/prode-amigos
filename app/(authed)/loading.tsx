/** Esqueleto que Next muestra al instante al navegar entre páginas,
 *  mientras el server arma la página real. El sidebar/bottom-nav no se
 *  recargan (viven en el layout); solo parpadea este contenido. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-1" aria-hidden>
      <div className="h-7 w-44 rounded-lg bg-cream/15" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-cream/10" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-cream/10" />
        ))}
      </div>
    </div>
  );
}
