import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn, hasSupabaseEnv } from "@/lib/utils";
import { TAG_TONE_CLASS, toneForTag } from "@/lib/tags";
import { computeAutoBadges } from "@/lib/badges";
import { computeAdn } from "@/lib/adn";
import { AdnFutbolero } from "@/components/player/adn-futbolero";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

interface LogRow {
  user_id: string;
  points: number;
  breakdown: Record<string, number> | null;
  source_id: string;
}

function tally(logs: LogRow[], userId: string) {
  let exactos = 0;
  let aciertos = 0;
  const byMatch = new Map<string, number>();
  for (const l of logs) {
    if (l.user_id !== userId) continue;
    const bd = l.breakdown ?? {};
    if ((bd.exact_score ?? 0) > 0) exactos++;
    if ((bd.winner_correct ?? 0) > 0) aciertos++;
    byMatch.set(l.source_id, (byMatch.get(l.source_id) ?? 0) + (l.points ?? 0));
  }
  return { exactos, aciertos, byMatch };
}

export default async function JugadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasSupabaseEnv()) redirect("/");
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/auth/login");
  const myId = claims.claims.sub as string;
  const isMe = myId === id;

  const { data: target } = await supabase
    .from("profiles")
    .select("id, nickname, tags, avatar_url")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      nickname: string;
      tags: string[];
      avatar_url: string | null;
    }>();
  if (!target) notFound();

  const [{ data: proj }, { data: logsRaw }, autoBadges, adn] = await Promise.all([
    supabase
      .from("leaderboard_projection")
      .select("user_id, total_points, rank")
      .in("user_id", isMe ? [id] : [id, myId]),
    supabase
      .from("points_log")
      .select("user_id, points, breakdown, source_id")
      .eq("source_kind", "match")
      .in("user_id", isMe ? [id] : [id, myId])
      .returns<LogRow[]>(),
    computeAutoBadges(supabase),
    computeAdn(supabase, id),
  ]);

  const projById = new Map((proj ?? []).map((r) => [r.user_id, r]));
  const logs = logsRaw ?? [];
  const tags = [
    ...new Set([...(target.tags ?? []), ...(autoBadges.get(id) ?? [])]),
  ];

  const them = projById.get(id);
  const themPts = them?.total_points ?? 0;
  const themRank = them?.rank ?? null;

  // Head-to-head (solo si no soy yo): record partido a partido + totales.
  let h2h: {
    mePts: number;
    meExactos: number;
    meAciertos: number;
    themExactos: number;
    themAciertos: number;
    wins: number;
    draws: number;
    losses: number;
  } | null = null;
  if (!isMe) {
    const meT = tally(logs, myId);
    const themT = tally(logs, id);
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const allMatchIds = new Set([...meT.byMatch.keys(), ...themT.byMatch.keys()]);
    for (const mid of allMatchIds) {
      const a = meT.byMatch.get(mid);
      const b = themT.byMatch.get(mid);
      if (a === undefined || b === undefined) continue; // ambos jugaron
      if (a > b) wins++;
      else if (a < b) losses++;
      else draws++;
    }
    h2h = {
      mePts: projById.get(myId)?.total_points ?? 0,
      meExactos: meT.exactos,
      meAciertos: meT.aciertos,
      themExactos: themT.exactos,
      themAciertos: themT.aciertos,
      wins,
      draws,
      losses,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
      <Link
        href="/leaderboard"
        className="text-xs font-semibold text-cream/70 hover:text-cream"
      >
        ← Volver al ranking
      </Link>

      {/* Encabezado del jugador */}
      <header className="flex items-center gap-4 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <Avatar
          src={target.avatar_url}
          name={target.nickname}
          className="size-14 text-2xl"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-black">
            {target.nickname}
            {isMe && <span className="text-ink/40"> (vos)</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {themRank !== null && (
              <span className="font-bold text-pitch">{themRank}° puesto</span>
            )}
            <span className="font-black tabular-nums">{themPts} pts</span>
          </div>
          {tags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    TAG_TONE_CLASS[toneForTag(t)],
                  )}
                >
                  {t}
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      {/* Vos vs Él */}
      {h2h && (
        <section className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
            ⚔️ Vos vs {target.nickname}
          </span>
          <div className="grid grid-cols-3 items-center gap-2 text-center">
            <span className="text-sm font-bold text-ink/70">Vos</span>
            <span className="text-[11px] font-bold uppercase text-ink/40">
              vs
            </span>
            <span className="truncate text-sm font-bold text-ink/70">
              {target.nickname}
            </span>

            <Stat me={h2h.mePts} them={themPts} label="puntos" />
            <Stat me={h2h.meAciertos} them={h2h.themAciertos} label="aciertos" />
            <Stat me={h2h.meExactos} them={h2h.themExactos} label="exactos" />
          </div>
          <div className="rounded-xl bg-ink/[0.04] p-3 text-center text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink/45">
              Mano a mano (partidos que jugaron los dos)
            </span>
            <p className="mt-1 font-black tabular-nums">
              <span className="text-grass">{h2h.wins}G</span> ·{" "}
              <span className="text-ink/60">{h2h.draws}E</span> ·{" "}
              <span className="text-cardred">{h2h.losses}P</span>
            </p>
            <p className="mt-0.5 text-xs text-ink/55">
              {h2h.wins > h2h.losses
                ? "Le venís ganando 😎"
                : h2h.wins < h2h.losses
                  ? "Te viene ganando 😬"
                  : "Está parejo"}
            </p>
          </div>
        </section>
      )}

      {/* ADN futbolero */}
      {adn ? (
        <AdnFutbolero adn={adn} nick={target.nickname} />
      ) : (
        <p className="text-sm text-cream/70">
          {target.nickname} todavía no cargó picks propios suficientes para el ADN.
        </p>
      )}
    </div>
  );
}

function Stat({ me, them, label }: { me: number; them: number; label: string }) {
  return (
    <>
      <span
        className={cn(
          "text-lg font-black tabular-nums",
          me > them ? "text-grass" : me < them ? "text-ink/50" : "text-ink",
        )}
      >
        {me}
      </span>
      <span className="text-[11px] text-ink/45">{label}</span>
      <span
        className={cn(
          "text-lg font-black tabular-nums",
          them > me ? "text-grass" : them < me ? "text-ink/50" : "text-ink",
        )}
      >
        {them}
      </span>
    </>
  );
}
