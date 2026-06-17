import type { Recap } from "@/lib/recap";
import { CrownedAvatar } from "@/components/crowned-avatar";
import { TAG_TONE_CLASS } from "@/lib/tags";
import { cn } from "@/lib/utils";

function joinNicks(nicks: string[]): string {
  if (nicks.length <= 1) return nicks[0] ?? "—";
  return `${nicks.slice(0, -1).join(", ")} y ${nicks[nicks.length - 1]}`;
}

/**
 * "Tag de la fecha": reparto visual de títulos temáticos de la última fecha
 * (🔥 El Crack, 🎯 El Francotirador, 🤡 La Mufa). Deriva del recap (no agrega
 * consultas). Complementa al diario con una vista de "ceremonia".
 */
export function TagDeLaFecha({ recap }: { recap: Recap }) {
  // El Francotirador de la fecha: el que más clavadas (exactos) tuvo.
  const exactosByNick = new Map<string, number>();
  for (const e of recap.exactos) {
    exactosByNick.set(e.nickname, (exactosByNick.get(e.nickname) ?? 0) + 1);
  }
  let franco: string | null = null;
  let francoN = 0;
  for (const [n, c] of exactosByNick) {
    if (c > francoN) {
      francoN = c;
      franco = n;
    }
  }

  const rows: {
    nick: string;
    pill: string;
    tone: keyof typeof TAG_TONE_CLASS;
    sub: string;
    crowned?: boolean;
  }[] = [];
  if (recap.topNicks.length > 0) {
    rows.push({
      nick: joinNicks(recap.topNicks),
      pill: "👑 Rey de la fecha",
      tone: "gold",
      sub: `${recap.topPoints} pts en la fecha, intratable`,
      crowned: true,
    });
  }
  if (franco) {
    rows.push({
      nick: franco,
      pill: "🎯 El Francotirador",
      tone: "sky",
      sub: `clavó ${francoN} resultado${francoN === 1 ? "" : "s"} exacto${francoN === 1 ? "" : "s"}`,
    });
  }
  if (recap.bottomNicks.length > 0) {
    rows.push({
      nick: joinNicks(recap.bottomNicks),
      pill: "🤡 La Mufa",
      tone: "red",
      sub: `${recap.bottomPoints} pts, plantó la mufa`,
    });
  }
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
        🎖️ Tag de la fecha · {recap.dayLabel}
      </span>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-ink/[0.03] p-2"
        >
          <CrownedAvatar crowned={r.crowned} name={r.nick} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{r.nick}</div>
            <div className="truncate text-[11px] text-ink/55">{r.sub}</div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
              TAG_TONE_CLASS[r.tone],
            )}
          >
            {r.pill}
          </span>
        </div>
      ))}
    </div>
  );
}
