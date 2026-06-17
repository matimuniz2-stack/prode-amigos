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
interface LivePlay {
  minute: number;
  clock: string;
  rawType: string;
  category: "goal" | "shot" | "corner" | "foul" | "card" | "other";
  side: "home" | "away" | null;
  x: number | null;
  y: number | null;
  text: string;
}
interface LiveData {
  found: boolean;
  state: "pre" | "in" | "post";
  clock: string;
  home: LiveSide;
  away: LiveSide;
  events: LiveEvent[];
  plays: LivePlay[];
  commentary: { minute: number; text: string }[];
}

/** Orienta una posición a la cancha fija (home ataca a la derecha).
 *  Devuelve cx/cy en 0-100 (porcentaje del contenedor). */
function orient(
  x: number | null,
  y: number | null,
  side: "home" | "away" | null,
): { cx: number; cy: number } | null {
  if (x == null || y == null || !side) return null;
  return side === "home"
    ? { cx: x, cy: y }
    : { cx: 100 - x, cy: 100 - y };
}

/** Plotea un gol en la cancha (viewBox 100x64). */
function plotGoal(e: LiveEvent): { cx: number; cy: number } | null {
  const p = orient(e.x, e.y, e.side);
  return p ? { cx: p.cx, cy: (p.cy / 100) * 64 } : null;
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

export function LivePitch({
  matchId,
  myHome = null,
  myAway = null,
}: {
  matchId: string;
  myHome?: number | null;
  myAway?: number | null;
}) {
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

  // Tiros posicionados (del relato) para el mapa de la cancha.
  const shotPlays = (data.plays ?? []).filter((p) => p.category === "shot");

  // Pelota: posición REAL del último evento del relato con coordenadas.
  const positioned = (data.plays ?? []).filter((p) => p.x != null && p.y != null);
  const lastPlay = positioned[positioned.length - 1] ?? null;
  const ball = lastPlay ? orient(lastPlay.x, lastPlay.y, lastPlay.side) : null;

  // Minuto actual (del reloj "66'" o del último evento) para la win-prob.
  const minute =
    data.state === "post"
      ? 90
      : parseInt(data.clock, 10) ||
        Math.max(0, ...data.events.map((e) => e.minute), 0);
  const wp = winProb(data.home.score, data.away.score, minute, pressH);

  // Timeline de eventos en orden cronológico.
  const timeline = [...data.events].sort((a, b) => a.minute - b.minute);

  // ¿El marcador en vivo es EXACTAMENTE tu pick? → "gol en mi pick".
  const pickLoaded = myHome != null && myAway != null;
  const pickIsLive =
    pickLoaded &&
    data.state === "in" &&
    data.home.score === myHome &&
    data.away.score === myAway;

  // Nota para tu pick según la win-prob.
  let pickNote: string | null = null;
  if (pickLoaded) {
    const mySide =
      (myHome as number) > (myAway as number)
        ? "home"
        : (myHome as number) < (myAway as number)
          ? "away"
          : "draw";
    const myProb =
      mySide === "home" ? wp.home : mySide === "away" ? wp.away : wp.draw;
    pickNote =
      myProb >= 55
        ? "✅ Tu pick viene cómodo. Aguantá el resultado."
        : myProb >= 35
          ? "🤔 Tu pick está peleado, no aflojes."
          : "😬 Se te está complicando el pick…";
  }

  const sharePick = async () => {
    const txt = `¡Lo dije! Tengo clavado ${data.home.name} ${data.home.score}-${data.away.score} ${data.away.name} en el prode 😎\nprodelospibes.com`;
    try {
      if (navigator.share) await navigator.share({ text: txt });
      else await navigator.clipboard.writeText(txt);
    } catch {
      /* cancelado */
    }
  };

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

      {/* Gol en mi pick: el marcador en vivo es exactamente tu pronóstico */}
      {pickIsLive && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-pitch p-3 text-cream ring-1 ring-gold/40">
          <div className="min-w-0">
            <div className="text-display text-base leading-none text-gold">
              ⚽ ¡VA TU PICK!
            </div>
            <div className="mt-0.5 truncate text-[11px] text-cream/80">
              {data.home.name} {data.home.score}-{data.away.score} — si termina
              así, pleno 🎯
            </div>
          </div>
          <button
            type="button"
            onClick={sharePick}
            className="shrink-0 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
          >
            Compartir 💬
          </button>
        </div>
      )}

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

      {/* Win-probability casera (estimación según marcador, minuto y tiros) */}
      {data.state === "in" && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink/45">
            <span>📊 ¿Quién la gana?</span>
            <span>{minute}&apos;</span>
          </div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-ink">
            <span className="min-w-0 truncate">
              {data.home.name} {wp.home}%
            </span>
            <span className="shrink-0 text-ink/45">Empate {wp.draw}%</span>
            <span className="min-w-0 truncate text-right">
              {wp.away}% {data.away.name}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-ink/10">
            <div style={{ width: `${wp.home}%`, background: HOME }} className="transition-all duration-700" />
            <div style={{ width: `${wp.draw}%`, background: "#9ca3af" }} className="transition-all duration-700" />
            <div style={{ width: `${wp.away}%`, background: AWAY }} className="transition-all duration-700" />
          </div>
          {pickNote && (
            <div className="mt-2 rounded-lg bg-pitch-deep px-2.5 py-1.5 text-[11px] font-semibold text-gold">
              {pickNote}
            </div>
          )}
        </div>
      )}

      {/* La cancha */}
      <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-black/10">
        {/* Tinte de dominio: cada equipo ataca hacia su lado (home → derecha). */}
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-all duration-700"
          style={{
            background: `linear-gradient(90deg, ${AWAY}${alpha(pressA)} 0%, transparent 42%, transparent 58%, ${HOME}${alpha(pressH)} 100%)`,
          }}
        />
        {/* Pelota: posición REAL del último evento del relato (no es tracking
            continuo, pero salta a la zona donde fue la última jugada). */}
        {ball && (
          <div
            className="pointer-events-none absolute z-[13] -translate-x-1/2 -translate-y-1/2 text-xl transition-all duration-1000 ease-out"
            style={{
              left: `${ball.cx}%`,
              top: `${ball.cy}%`,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
            }}
          >
            ⚽
          </div>
        )}
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

          {/* Tiros ploteados en su posición real (del relato) */}
          {shotPlays.map((p, i) => {
            const pos = orient(p.x, p.y, p.side);
            if (!pos) return null;
            const col = p.side === "home" ? HOME : AWAY;
            const onTarget = /on-target|saved|goal/i.test(p.rawType);
            return (
              <circle
                key={`s${i}`}
                cx={pos.cx}
                cy={(pos.cy / 100) * 64}
                r={1.1}
                fill={onTarget ? col : "none"}
                stroke={col}
                strokeWidth={0.5}
                opacity={0.85}
              />
            );
          })}

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

      {/* Leyenda */}
      <p className="-mt-1 text-center text-[10px] text-ink/45">
        ⚽ última jugada · ● tiro al arco · ○ tiro afuera ·{" "}
        <span style={{ color: HOME }}>▬</span> {data.home.name} ·{" "}
        <span style={{ color: AWAY }}>▬</span> {data.away.name}
      </p>

      {/* Timeline de eventos del partido (goles, tarjetas, cambios) */}
      {timeline.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-ink/[0.04] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink/45">
            📜 Timeline del partido
          </span>
          {timeline.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-9 shrink-0 text-right font-black tabular-nums text-ink/50">
                {e.clock || `${e.minute}'`}
              </span>
              <span aria-hidden className="shrink-0 text-sm">
                {eventEmoji(e.type)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-bold text-ink">
                  {e.player ?? eventLabel(e.type)}
                </span>
                {e.side && (
                  <span className="text-ink/50">
                    {" · "}
                    {e.side === "home" ? data.home.name : data.away.name}
                  </span>
                )}
              </span>
              {e.type === "goal" && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: e.side === "home" ? HOME : AWAY }}
                />
              )}
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

/** Win-probability casera: heurística simple según ventaja, minuto y dominio
 *  de tiros/posesión. No es un modelo serio (de ahí "casera"). Devuelve % que
 *  suman 100. */
function winProb(home: number, away: number, minute: number, pressH: number) {
  const lead = home - away;
  const t = Math.min(1, minute / 95);
  const edge = (pressH - 50) / 50; // -1..1 (dominio de tiros/posesión)
  const m = lead * (1.1 + t * 1.7) + edge * 0.8 * (1 - t * 0.4);
  const pHomeRaw = 1 / (1 + Math.exp(-m));
  let draw =
    Math.max(4, 30 * (1 - t) * (1 - Math.min(1, Math.abs(lead) * 0.5))) +
    (lead === 0 ? 14 * t : 0);
  draw = Math.min(60, draw);
  let h = Math.round((100 - draw) * pHomeRaw);
  let a = Math.round((100 - draw) * (1 - pHomeRaw));
  let d = 100 - h - a;
  if (d < 0) {
    if (h >= a) h += d;
    else a += d;
    d = 0;
  }
  return { home: h, draw: d, away: a };
}

function eventEmoji(type: LiveEvent["type"]): string {
  switch (type) {
    case "goal":
      return "⚽";
    case "yellow":
      return "🟨";
    case "red":
      return "🟥";
    case "sub":
      return "🔁";
    case "penalty":
      return "🎯";
    case "var":
      return "📺";
    default:
      return "•";
  }
}

function eventLabel(type: LiveEvent["type"]): string {
  switch (type) {
    case "goal":
      return "Gol";
    case "yellow":
      return "Amarilla";
    case "red":
      return "Roja";
    case "sub":
      return "Cambio";
    case "penalty":
      return "Penal";
    case "var":
      return "VAR";
    default:
      return "Evento";
  }
}
