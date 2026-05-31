/** Esqueleto neutro que Next muestra al instante al navegar entre páginas,
 *  mientras el server arma la página real. Aplica a todas las rutas authed,
 *  así que es genérico a propósito (barras simples) para no chocar con los
 *  layouts distintos de ranking/reglas/partidos. El sidebar/bottom-nav no se
 *  recargan (viven en el layout); solo parpadea este contenido. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4 pt-1" aria-hidden>
      <div className="h-7 w-44 rounded-lg bg-cream/15" />
      <div className="h-24 rounded-2xl bg-cream/10" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-cream/10" />
        ))}
      </div>
    </div>
  );
}
