import type { Career } from "@/lib/career";

const COLORS = [
  "#FFD23F", "#2BB673", "#E8543F", "#3B9AE1", "#B06FE8",
  "#F2913D", "#E84D8A", "#43C6B7", "#9AB534", "#7A86F0",
];

const W = 340;
const H = 200;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

/**
 * Gráfico de la carrera: líneas de puntos acumulados por fecha. SVG propio,
 * sin dependencias. Una línea por jugador; la del usuario (myId) va resaltada.
 */
export function CareerChart({
  career,
  myId,
}: {
  career: Career;
  myId: string;
}) {
  const { days, series } = career;
  const n = days.length;
  const maxY = Math.max(1, ...series.map((s) => s.total));

  const xLeft = PAD_L;
  const xRight = W - PAD_R;
  const yTop = PAD_T;
  const yBottom = H - PAD_B;

  const xAt = (i: number) =>
    n <= 1 ? (xLeft + xRight) / 2 : xLeft + (i / (n - 1)) * (xRight - xLeft);
  const yAt = (v: number) => yBottom - (v / maxY) * (yBottom - yTop);

  // Líneas horizontales de guía (0, mitad, max).
  const guides = [0, Math.round(maxY / 2), maxY];

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
        📈 El gráfico de la carrera
      </span>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Puntos acumulados por fecha"
      >
        {/* Guías + eje Y */}
        {guides.map((g) => (
          <g key={g}>
            <line
              x1={xLeft}
              y1={yAt(g)}
              x2={xRight}
              y2={yAt(g)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
            <text
              x={xLeft - 4}
              y={yAt(g) + 3}
              textAnchor="end"
              className="fill-ink/40"
              fontSize={8}
            >
              {g}
            </text>
          </g>
        ))}

        {/* Etiquetas de fecha en X (F1, F2, ...) */}
        {days.map((d, i) => (
          <text
            key={d.key}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-ink/40"
            fontSize={8}
          >
            F{i + 1}
          </text>
        ))}

        {/* Una línea por jugador */}
        {series.map((s, idx) => {
          const color = COLORS[idx % COLORS.length];
          const isMe = s.userId === myId;
          const pts = s.cumulative.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
          return (
            <g key={s.userId}>
              {n > 1 && (
                <polyline
                  points={pts}
                  fill="none"
                  stroke={color}
                  strokeWidth={isMe ? 3 : 1.5}
                  strokeOpacity={isMe ? 1 : 0.7}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.cumulative.map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={isMe ? 2.6 : 1.8}
                  fill={color}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {series.map((s, idx) => {
          const color = COLORS[idx % COLORS.length];
          const isMe = s.userId === myId;
          return (
            <span key={s.userId} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className={isMe ? "font-black" : "font-medium text-ink/70"}>
                {s.nickname}
                {isMe && " (vos)"}
              </span>
              <span className="tabular-nums text-ink/40">{s.total}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
