"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const HOME = "#FFD23F"; // dorado
const AWAY = "#38BDF8"; // celeste

interface LiveStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellow: number | null;
  red: number | null;
  saves: number | null;
}
interface LiveSide {
  code: string | null;
  name: string;
  score: number;
  stats: LiveStats | null;
}
interface LiveEvent {
  minute: number;
  clock: string;
  type: "goal" | "yellow" | "red" | "sub" | "var" | "penalty" | "other";
  side: "home" | "away" | null;
  scoringPlay: boolean;
  text: string;
  shortText: string;
  player: string | null;
  x: number | null;
  y: number | null;
  goalY: number | null;
}
interface LiveData {
  found: boolean;
  state: "pre" | "in" | "post";
  clock: string;
  home: LiveSide;
  away: LiveSide;
  events: LiveEvent[];
  commentary: { minute: number; text: string }[];
}

/** Plotea un gol en la cancha (viewBox 100x64). Home ataca a la derecha. */
function plotGoal(e: LiveEvent): { cx: number; cy: number } | null {
  if (e.x == null || e.y == null || !e.side) return null;
  const cx = e.side === "home" ? e.x : 100 - e.x;
  const cy = e.side === "home" ? e.y : 100 - e.y;
  return { cx, cy: (cy / 100) * 64 };
}

function num(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Alpha en hex (00-5a) según cuánto supera el 50% de presión un equipo. */
function alpha(press: number): string {
  return Math.round(Math.max(0, (press - 50) / 50) * 90)
    .toString(16)
    .padStart(2, "0");
}

export function LivePitch({ matchId }: { matchId: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState<LiveEvent | null>(null);
  const prevGoals = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/live/${matchId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as LiveData;
        if (!alive) return;
        setLoaded(true);
        if (!json.found) return;
        // Detectar gol nuevo para el flash "GOOOL".
        const goals = json.events.filter((e) => e.type === "goal");
        if (prevGoals.current !== null && goals.length > prevGoals.current) {
          const last = goals[goals.length - 1];
          setFlash(last);
          setTimeout(() => setFlash(null), 6000);
        }
        prevGoals.current = goals.length;
        setData(json);
      } catch {
        /* reintenta en el próximo tick */
      }
    }
    load();
    const id = setInterval(load, 22000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [matchId]);

  if (!data) {
    return (
      <div className="rounded-2xl bg-pitch-deep p-6 text-center text-sm text-cream/60">
        {loaded
          ? "ESPN todavía no publica datos en vivo de este partido."
          : "Cargando la cancha en vivo…"}
      </div>
    );
  }

  const hs = data.home.stats;
  const as = data.away.stats;
  const possH = hs?.possession;
  const possA = as?.possession;

  // Presión: posesión mezclada con el reparto de tiros (aprox, no es posición real).
  const shotsH = num(hs?.shots);
  const shotsA = num(as?.shots);
  const shotShare =
    shotsH + shotsA > 0 ? (shotsH / (shotsH + shotsA)) * 100 : 50;
  const base = possH ?? 50;
  const pressH = Math.round(
    shotsH + shotsA > 0 ? 0.6 * base + 0.4 * shotShare : base,
  );
  const pressA = 100 - pressH;

  const goals = data.events.filter((e) => e.type === "goal");

  return (
    <div className="flex flex-col gap-3">
      {/* Marcador + reloj */}
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-right text-sm font-extrabold text-ink">
          {data.home.name}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-2xl font-black tabular-nums text-ink">
            {data.home.score} - {data.away.score}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">
          {data.away.name}
        </span>
      </div>
      <div className="flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cardred/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-cardred">
          <span className="size-2 animate-pulse rounded-full bg-cardred" />
          {data.state === "post" ? "Finalizado" : data.clock || "En vivo"}
        </span>
      </div>

      {/* Presión / dominio */}
      <div>
        <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-ink/45">
          <span>Presión</span>
          <span>{pressH}% · {pressA}%</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink/10">
          <div style={{ width: `${pressH}%`, background: HOME }} className="transition-all duration-700" />
          <div style={{ width: `${pressA}%`, background: AWAY }} className="transition-all duration-700" />
        </div>
      </div>

      {/* La cancha */}
      <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-black/10">
        {/* Tinte de dominio: cada equipo ataca hacia su lado (home → derecha). */}
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-all duration-700"
          style={{
            background: `linear-gradient(90deg, ${AWAY}${alpha(pressA)} 0%, transparent 42%, transparent 58%, ${HOME}${alpha(pressH)} 100%)`,
          }}
        />
        {/* Pelota de momentum: siempre presente, se desliza con la presión. */}
        <div
          className="pointer-events-none absolute top-1/2 z-[12] -translate-x-1/2 -translate-y-1/2 text-xl transition-all duration-1000 ease-out"
          style={{ left: `${pressH}%`, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
        >
          ⚽
        </div>
        {/* Tiros por equipo, en su arco de ataque (home ataca a la derecha) */}
        <div className="pointer-events-none absolute right-2 top-2 z-[12] flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-cream">
          <span style={{ color: HOME }}>●</span> {num(hs?.shots)} tiros · {num(hs?.shotsOnTarget)} 🎯
        </div>
        <div className="pointer-events-none absolute left-2 top-2 z-[12] flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-cream">
          <span style={{ color: AWAY }}>●</span> {num(as?.shots)} tiros · {num(as?.shotsOnTarget)} 🎯
        </div>
        <svg viewBox="0 0 100 64" className="block w-full" style={{ background: "#0f7a4d" }}>
          {/* Rayas de césped */}
          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={i}
              x={(i * 100) / 6}
              y={0}
              width={100 / 6}
              height={64}
              fill={i % 2 ? "#0d6e45" : "#0f7a4d"}
            />
          ))}
          <g fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={0.4}>
            <rect x={1} y={1} width={98} height={62} />
            <line x1={50} y1={1} x2={50} y2={63} />
            <circle cx={50} cy={32} r={9} />
            {/* Áreas */}
            <rect x={1} y={13} width={15} height={38} />
            <rect x={84} y={13} width={15} height={38} />
            <rect x={1} y={23} width={6} height={18} />
            <rect x={93} y={23} width={6} height={18} />
            {/* Arcos */}
            <rect x={-0.5} y={27} width={1.5} height={10} stroke="rgba(255,255,255,0.85)" />
            <rect x={99} y={27} width={1.5} height={10} stroke="rgba(255,255,255,0.85)" />
          </g>
          <circle cx={50} cy={32} r={0.7} fill="rgba(255,255,255,0.7)" />

          {/* Goles ploteados en su posición real */}
          {goals.map((e, i) => {
            const p = plotGoal(e);
            if (!p) return null;
            const col = e.side === "home" ? HOME : AWAY;
            const isLast = i === goals.length - 1;
            return (
              <g key={i}>
                <line
                  x1={p.cx}
                  y1={p.cy}
                  x2={e.side === "home" ? 99 : 1}
                  y2={32}
                  stroke={col}
                  strokeWidth={0.4}
                  strokeDasharray="1 1"
                  opacity={0.7}
                />
                <circle cx={p.cx} cy={p.cy} r={isLast ? 2.2 : 1.6} fill={col} stroke="#0a3" strokeWidth={0.3}>
                  {isLast && (
                    <animate attributeName="r" values="1.8;3;1.8" dur="1.2s" repeatCount="indefinite" />
                  )}
                </circle>
                <text x={p.cx} y={p.cy + 0.9} textAnchor="middle" fontSize={2.2} fontWeight="bold" fill="#0a3">
                  ⚽
                </text>
              </g>
            );
          })}
        </svg>

        {/* Flash de GOL */}
        {flash && (
          <div className="absolute inset-0 z-20 flex animate-fade-up flex-col items-center justify-center bg-black/45 text-center">
            <span className="text-4xl font-black tracking-widest text-gold drop-shadow">
              ⚽ ¡GOOOL!
            </span>
            {flash.player && (
              <span className="mt-1 text-sm font-bold text-cream">{flash.player}</span>
            )}
            <span className="text-xs text-cream/80">
              {flash.side === "home" ? data.home.name : data.away.name} · {flash.clock}
            </span>
          </div>
        )}
      </div>

      {/* Goles listados con el arco */}
      {goals.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-ink/[0.04] p-3">
          {goals.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-black tabular-nums text-ink/50">{e.clock}</span>
              <span
                className="size-2 rounded-full"
                style={{ background: e.side === "home" ? HOME : AWAY }}
              />
              <span className="font-bold text-ink">{e.player ?? "Gol"}</span>
              <span className="truncate text-ink/55">
                {e.side === "home" ? data.home.name : data.away.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stats en vivo */}
      <div className="grid grid-cols-3 gap-x-2 rounded-xl bg-cream p-3 text-center text-sm ring-1 ring-black/5">
        <StatRow label="Posesión" h={possH != null ? `${Math.round(possH)}%` : "—"} a={possA != null ? `${Math.round(possA)}%` : "—"} />
        <StatRow label="Tiros" h={hs?.shots} a={as?.shots} />
        <StatRow label="Al arco" h={hs?.shotsOnTarget} a={as?.shotsOnTarget} />
        <StatRow label="Córners" h={hs?.corners} a={as?.corners} />
        <StatRow label="Faltas" h={hs?.fouls} a={as?.fouls} />
        <StatRow label="Amarillas" h={hs?.yellow} a={as?.yellow} />
      </div>

      {/* Relato en vivo */}
      {data.commentary.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-pitch-deep p-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-cream/45">
            🎙️ Relato en vivo
          </span>
          {[...data.commentary].reverse().slice(0, 4).map((c, i) => (
            <p
              key={i}
              className={cn(
                "text-xs leading-snug",
                i === 0 ? "font-semibold text-cream" : "text-cream/55",
              )}
            >
              {c.minute > 0 && (
                <span className="mr-1 font-black tabular-nums text-gold">{c.minute}'</span>
              )}
              {c.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  h,
  a,
}: {
  label: string;
  h: number | string | null | undefined;
  a: number | string | null | undefined;
}) {
  const hv = h ?? "—";
  const av = a ?? "—";
  const hn = typeof h === "number" ? h : -1;
  const an = typeof a === "number" ? a : -1;
  return (
    <>
      <span className={cn("py-1 text-left font-black tabular-nums", hn > an ? "text-ink" : "text-ink/55")}>
        {hv}
      </span>
      <span className="py-1 text-[11px] font-bold uppercase tracking-wide text-ink/40">
        {label}
      </span>
      <span className={cn("py-1 text-right font-black tabular-nums", an > hn ? "text-ink" : "text-ink/55")}>
        {av}
      </span>
    </>
  );
}
