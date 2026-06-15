import type { Recap } from "@/lib/recap";

function joinNicks(nicks: string[]): string {
  if (nicks.length <= 1) return nicks[0] ?? "—";
  return `${nicks.slice(0, -1).join(", ")} y ${nicks[nicks.length - 1]}`;
}

export function RecapFecha({ recap }: { recap: Recap }) {
  const { dayLabel, topNicks, topPoints, exactos, plenos } = recap;

  return (
    <section className="overflow-hidden rounded-2xl bg-cream text-ink shadow-card ring-1 ring-black/5">
      <div className="bg-pitch px-4 py-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-cream/70">
          📋 Recap de la fecha
        </div>
        <div className="text-sm font-extrabold capitalize text-cream">
          {dayLabel}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-4 text-sm">
        {topNicks.length > 0 ? (
          <p>
            👑 <span className="font-bold">Mejor de la fecha:</span>{" "}
            <span className="font-black">{joinNicks(topNicks)}</span>{" "}
            <span className="font-black tabular-nums text-pitch">
              (+{topPoints})
            </span>
          </p>
        ) : (
          <p className="text-ink/60">
            🥶 Fecha para el olvido: nadie sumó un solo punto.
          </p>
        )}

        {exactos.length > 0 && (
          <div className="flex flex-col gap-1">
            {exactos.slice(0, 4).map((e, i) => (
              <p key={i}>
                🎯 <span className="font-bold">{e.nickname}</span> clavó el{" "}
                <span className="font-black tabular-nums">{e.score}</span> de{" "}
                {e.matchLabel}
              </p>
            ))}
          </div>
        )}

        {plenos.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-black/5 pt-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/45">
              💀 No la pegó nadie
            </p>
            {plenos.map((p, i) => (
              <p key={i} className="text-ink/70">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
