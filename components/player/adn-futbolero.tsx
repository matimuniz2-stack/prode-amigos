import type { Adn } from "@/lib/adn";

export function AdnFutbolero({ adn, nick }: { adn: Adn; nick: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
          🧬 ADN futbolero
        </span>
        <span className="text-[11px] text-ink/40">{adn.totalPicks} picks propios</span>
      </div>

      {adn.traits.length > 0 ? (
        <div className="flex flex-col gap-2">
          {adn.traits.map((t) => (
            <div key={t.label} className="flex items-start gap-2.5">
              <span aria-hidden className="text-xl leading-none">
                {t.emoji}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-extrabold">{t.label}</span>
                <span className="text-xs text-ink/60">{t.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/60">
          {nick} todavía no cargó suficientes picks para sacarle el ADN.
        </p>
      )}
    </section>
  );
}
