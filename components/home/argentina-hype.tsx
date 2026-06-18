"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONFETTI_COLORS = ["#75AADB", "#ffffff", "#FFD23F", "#5b8fc7"];

/** Banner festivo albiceleste para el partido de Argentina. */
export function ArgentinaHype({
  opponentName,
  opponentFlag,
  whenLabel,
  live,
  href,
}: {
  opponentName: string;
  opponentFlag: string | null;
  whenLabel: string;
  live: boolean;
  href: string;
}) {
  // Piezas de confeti: se generan en el cliente (useEffect) para no romper la
  // hidratación con Math.random (en SSR el server las calculaba distinto).
  const [pieces, setPieces] = useState<
    {
      id: number;
      left: number;
      delay: number;
      dur: number;
      size: number;
      color: string;
      round: boolean;
    }[]
  >([]);
  useEffect(() => {
    setPieces(
      Array.from({ length: 34 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        dur: 2.6 + Math.random() * 2.6,
        size: 5 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
      })),
    );
  }, []);

  return (
    <Link
      href={href}
      className="relative block overflow-hidden rounded-2xl shadow-card ring-1 ring-black/10 transition active:scale-[0.99]"
    >
      {/* Fondo: franjas celeste / blanco / celeste */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#75AADB_0%,#75AADB_30%,#ffffff_30%,#ffffff_70%,#75AADB_70%,#75AADB_100%)]" />

      {/* Confeti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 block"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.round ? "9999px" : "1px",
              animation: `confetti-fall ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Contenido */}
      <div className="relative flex flex-col items-center gap-1 px-4 py-5 text-center">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#0A3161]">
          <span>⭐⭐⭐</span>
          <span>{live ? "¡Argentina en la cancha!" : "Hoy juega Argentina"}</span>
          <span>⭐⭐⭐</span>
        </div>

        <h2 className="text-display text-3xl font-black leading-none text-[#0A3161] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
          ¡VAMOS ARGENTINA!
        </h2>

        <div className="mt-1 flex items-center gap-2 text-base font-extrabold text-[#0A3161]">
          <span>🇦🇷 Argentina</span>
          <span className="text-[#0A3161]/60">vs</span>
          <span>
            {opponentFlag ? `${opponentFlag} ` : ""}
            {opponentName}
          </span>
        </div>

        <div className="mt-0.5">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cardred px-3 py-0.5 text-xs font-bold uppercase text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              En vivo
            </span>
          ) : (
            <span className="rounded-full bg-[#0A3161] px-3 py-0.5 text-xs font-bold text-white">
              {whenLabel}
            </span>
          )}
        </div>

        <span className="mt-2 text-[11px] font-bold text-[#0A3161]/70">
          {live ? "Seguilo en la sala en vivo →" : "Cargá tu pick 🎯 →"}
        </span>
      </div>
    </Link>
  );
}
