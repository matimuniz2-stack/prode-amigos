import { cn } from "@/lib/utils";
import type { DemoPlayer } from "@/lib/demo-data";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

const PODIUM = {
  1: {
    bar: "h-20 bg-gradient-to-b from-gold to-amber-500",
    ring: "ring-gold",
    pts: "text-gold",
  },
  2: {
    bar: "h-14 bg-gradient-to-b from-slate-200 to-slate-400",
    ring: "ring-slate-300",
    pts: "text-cream/70",
  },
  3: {
    bar: "h-10 bg-gradient-to-b from-amber-600 to-amber-800",
    ring: "ring-amber-600",
    pts: "text-cream/70",
  },
} as const;

/** Podio visual de los 3 primeros (2 - 1 - 3, el campeón al centro y más alto). */
export function RankingPodium({ players }: { players: DemoPlayer[] }) {
  const byRank = (r: number) => players.find((p) => p.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)].filter(
    (p): p is DemoPlayer => Boolean(p),
  );

  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((p) => {
        const m = PODIUM[p.rank as 1 | 2 | 3] ?? PODIUM[3];
        return (
          <div key={p.rank} className="flex flex-1 flex-col items-center gap-1">
            {p.rank === 1 && (
              <span aria-hidden className="-mb-1 text-lg">
                👑
              </span>
            )}
            <div
              className={cn(
                "grid size-11 place-items-center rounded-full bg-cream text-lg font-black text-ink ring-2",
                m.ring,
              )}
            >
              {initial(p.name)}
            </div>
            <span className="text-sm font-bold text-cream">{p.name}</span>
            <span className={cn("text-xs font-extrabold tabular-nums", m.pts)}>
              {p.points} pts
            </span>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-xl pt-1.5 text-xl font-black text-ink/80",
                m.bar,
              )}
            >
              {p.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Lista del resto del ranking (4° en adelante). */
export function RankingList({ players }: { players: DemoPlayer[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-black/20 ring-1 ring-cream/10">
      {players.map((p, i) => (
        <div
          key={p.rank}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5",
            i > 0 && "border-t border-cream/10",
          )}
        >
          <span className="w-5 text-center text-sm font-bold text-cream/55 tabular-nums">
            {p.rank}
          </span>
          <span className="flex-1 font-semibold text-cream">{p.name}</span>
          <span className="font-extrabold tabular-nums text-gold">
            {p.points} pts
          </span>
        </div>
      ))}
    </div>
  );
}
