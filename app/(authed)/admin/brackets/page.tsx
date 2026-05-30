import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { matchSelect, type MatchWithRelations } from "@/lib/matches";
import { SectionHeading } from "@/components/home/section-heading";
import {
  BracketsPanel,
  type Slot,
  type ThirdTeam,
} from "@/components/admin/brackets-panel";

export const dynamic = "force-dynamic";

// Slots de tercero del bracket oficial 2026 (home fijo + grupos permitidos).
const THIRD_SLOTS = [
  { matchNumber: 74, home: "1°E", allowed: ["A", "B", "C", "D", "F"] },
  { matchNumber: 77, home: "1°I", allowed: ["C", "D", "F", "G", "H"] },
  { matchNumber: 79, home: "1°A", allowed: ["C", "E", "F", "H", "I"] },
  { matchNumber: 80, home: "1°L", allowed: ["E", "H", "I", "J", "K"] },
  { matchNumber: 81, home: "1°D", allowed: ["B", "E", "F", "I", "J"] },
  { matchNumber: 82, home: "1°G", allowed: ["A", "E", "H", "I", "J"] },
  { matchNumber: 85, home: "1°B", allowed: ["E", "F", "G", "I", "J"] },
  { matchNumber: 87, home: "1°K", allowed: ["D", "E", "I", "J", "L"] },
];

const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

type GS = {
  teamId: string;
  name: string;
  flag: string | null;
  group: string;
  pts: number;
  dg: number;
  gf: number;
};

const cmp = (a: GS, b: GS) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf;

export default async function AdminBracketsPage() {
  const supabase = await createClient();

  const { data: matchesData } = await supabase
    .from("matches")
    .select(matchSelect)
    .returns<MatchWithRelations[]>();
  const matches = matchesData ?? [];

  // Standings de fase de grupos
  const stats = new Map<string, GS>();
  const finishedPerGroup = new Map<string, number>();
  for (const m of matches) {
    if (
      m.stage?.code !== "group" ||
      m.status !== "finished" ||
      m.score_home == null ||
      m.score_away == null ||
      !m.home_team ||
      !m.away_team ||
      !m.group
    ) {
      continue;
    }
    const g = m.group.code;
    finishedPerGroup.set(g, (finishedPerGroup.get(g) ?? 0) + 1);
    const add = (
      t: { id: string; name: string; flag_emoji: string | null },
      gf: number,
      ga: number,
    ) => {
      const s =
        stats.get(t.id) ??
        ({
          teamId: t.id,
          name: t.name,
          flag: t.flag_emoji,
          group: g,
          pts: 0,
          dg: 0,
          gf: 0,
        } as GS);
      s.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
      s.dg += gf - ga;
      s.gf += gf;
      stats.set(t.id, s);
    };
    add(m.home_team, m.score_home, m.score_away);
    add(m.away_team, m.score_away, m.score_home);
  }

  const completedGroups = GROUP_CODES.filter(
    (g) => (finishedPerGroup.get(g) ?? 0) >= 6,
  );
  const allComplete = completedGroups.length === 12;

  const thirds: GS[] = [];
  for (const g of completedGroups) {
    const teams = [...stats.values()].filter((s) => s.group === g).sort(cmp);
    if (teams[2]) thirds.push(teams[2]);
  }
  const best8: ThirdTeam[] = allComplete
    ? [...thirds]
        .sort(cmp)
        .slice(0, 8)
        .map((t) => ({
          teamId: t.teamId,
          name: t.name,
          flag: t.flag,
          group: t.group,
          pts: t.pts,
        }))
    : [];

  const slotNums = THIRD_SLOTS.map((s) => s.matchNumber);
  const slotMatch = new Map(
    matches.filter((m) => slotNums.includes(m.match_number)).map((m) => [m.match_number, m]),
  );
  const slots: Slot[] = THIRD_SLOTS.map((s) => ({
    matchNumber: s.matchNumber,
    home: s.home,
    allowed: s.allowed,
    currentThird: slotMatch.get(s.matchNumber)?.away_team?.name ?? null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Cruces</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>

      <BracketsPanel
        completedCount={completedGroups.length}
        allComplete={allComplete}
        best8={best8}
        slots={slots}
      />
    </div>
  );
}
