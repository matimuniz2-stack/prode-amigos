import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/countdown";
import { SectionHeading } from "@/components/home/section-heading";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

const CATS = [
  { key: "champion", emoji: "🏆", label: "Campeón", player: false },
  { key: "runner_up", emoji: "🥈", label: "Subcampeón", player: false },
  { key: "top_scorer", emoji: "👟", label: "Goleador", player: true },
  { key: "mvp", emoji: "⭐", label: "Mejor jugador (MVP)", player: true },
  { key: "revelation", emoji: "🌟", label: "Revelación", player: true },
] as const;

interface Pick {
  teamId: string | null;
  playerTeamId: string | null;
  playerName: string | null;
}

export default async function GlobalesTodosPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const myId = claims.claims.sub as string;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, globals_lock_at")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return (
      <p className="pt-2 text-sm text-cream/80">
        No hay torneo configurado todavía.
      </p>
    );
  }

  const locked =
    new Date(tournament.globals_lock_at).getTime() <= Date.now();

  // Antes del cierre no se revelan: cada uno copiaría al otro.
  if (!locked) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pt-1">
        <Header />
        <div className="rounded-2xl bg-cream p-5 text-center text-ink shadow-card ring-1 ring-black/5">
          <p className="text-base font-bold">🔒 Todavía no se revelan</p>
          <p className="mt-1 text-sm text-ink/60">
            Los globales de todos se destapan cuando arranque el Mundial —{" "}
            <span className="font-semibold text-pitch">
              <Countdown target={tournament.globals_lock_at} />
            </span>
            .
          </p>
        </div>
      </div>
    );
  }

  const [{ data: preds }, { data: teamRows }, { data: profileRows }] =
    await Promise.all([
      supabase
        .from("global_predictions")
        .select("user_id, category, team_id, player_team_id, player_name")
        .eq("tournament_id", tournament.id),
      supabase.from("teams").select("id, name, flag_emoji"),
      supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .order("nickname", { ascending: true }),
    ]);

  const teamById = new Map(
    (teamRows ?? []).map((t) => [
      t.id,
      { name: t.name as string, flag: (t.flag_emoji as string | null) ?? "" },
    ]),
  );
  const profileById = new Map(
    (profileRows ?? []).map((p) => [
      p.id,
      {
        nickname: (p.nickname as string) ?? "—",
        avatarUrl: (p.avatar_url as string | null) ?? null,
      },
    ]),
  );

  // picks[userId][category] = Pick
  const picksByUser = new Map<string, Map<string, Pick>>();
  for (const p of preds ?? []) {
    if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, new Map());
    picksByUser.get(p.user_id)!.set(p.category, {
      teamId: p.team_id,
      playerTeamId: p.player_team_id,
      playerName: p.player_name,
    });
  }

  // Jugadores que cargaron al menos un global, ordenados por nombre.
  const userIds = [...picksByUser.keys()].sort((a, b) =>
    (profileById.get(a)?.nickname ?? "").localeCompare(
      profileById.get(b)?.nickname ?? "",
    ),
  );

  if (userIds.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pt-1">
        <Header />
        <p className="text-sm text-cream/70">
          Todavía nadie cargó sus globales.
        </p>
      </div>
    );
  }

  // Texto del pick para una categoría (equipo y/o jugador).
  const labelFor = (pick: Pick | undefined, isPlayer: boolean) => {
    if (!pick) return null;
    const team = pick.teamId
      ? teamById.get(pick.teamId)
      : pick.playerTeamId
        ? teamById.get(pick.playerTeamId)
        : null;
    const flag = team?.flag ? `${team.flag} ` : "";
    if (isPlayer) {
      const name = pick.playerName?.trim();
      if (!name && !team) return null;
      return `${flag}${name || team?.name || "—"}`;
    }
    return team ? `${flag}${team.name}` : null;
  };

  // "Más elegido" por categoría: agrupa por el texto del pick.
  const consensusFor = (catKey: string, isPlayer: boolean) => {
    const counts = new Map<string, number>();
    for (const uid of userIds) {
      const txt = labelFor(picksByUser.get(uid)?.get(catKey), isPlayer);
      if (!txt) continue;
      counts.set(txt, (counts.get(txt) ?? 0) + 1);
    }
    let best: { txt: string; n: number } | null = null;
    for (const [txt, n] of counts) {
      if (!best || n > best.n) best = { txt, n };
    }
    return best && best.n > 1 ? best : null;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-4">
      <Header />

      <div className="flex flex-col gap-4">
        {CATS.map((cat) => {
          const consensus = consensusFor(cat.key, cat.player);
          return (
            <div
              key={cat.key}
              className="overflow-hidden rounded-2xl bg-cream text-ink shadow-card ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5">
                <span className="text-sm font-extrabold">
                  {cat.emoji} {cat.label}
                </span>
                {consensus && (
                  <span className="shrink-0 rounded-full bg-pitch/10 px-2 py-0.5 text-[10px] font-bold text-pitch">
                    más elegido: {consensus.txt} ({consensus.n})
                  </span>
                )}
              </div>
              <div>
                {userIds.map((uid, i) => {
                  const prof = profileById.get(uid);
                  const txt = labelFor(picksByUser.get(uid)?.get(cat.key), cat.player);
                  const isMe = uid === myId;
                  return (
                    <div
                      key={uid}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-2",
                        i > 0 && "border-t border-ink/[0.07]",
                        isMe && "bg-gold/15",
                      )}
                    >
                      <Avatar
                        src={prof?.avatarUrl ?? null}
                        name={prof?.nickname ?? "—"}
                        className="size-7 text-[11px]"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink/80">
                        {prof?.nickname ?? "—"}
                        {isMe && <span className="text-ink/40"> (vos)</span>}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-right text-xs font-bold",
                          txt ? "text-ink" : "text-ink/30",
                        )}
                      >
                        {txt ?? "sin cargar"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <SectionHeading>Globales de todos</SectionHeading>
      <Link
        href="/leaderboard"
        className="shrink-0 rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-cream/80 ring-1 ring-cream/15 transition active:scale-95"
      >
        ← Ranking
      </Link>
    </div>
  );
}
