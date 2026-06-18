"use client";

import { useEffect, useState } from "react";

const CONFETTI = ["#75AADB", "#ffffff", "#FFD23F"];

interface Piece {
  id: number;
  flag: boolean;
  left: number;
  delay: number;
  dur: number;
  size: number;
  color: string;
  sway: string;
  op: number;
  round: boolean;
}

/**
 * "Modo argentino" site-wide: una cintita celeste/blanca arriba y banderitas
 * 🇦🇷 + confeti cayendo suave por toda la pantalla. Fijo, sutil y sin bloquear
 * clicks. Se monta solo cuando hay partido de Argentina cerca o en vivo.
 * Las piezas se generan en el cliente (useEffect) para no romper la hidratación
 * con Math.random (el server renderiba valores distintos a los del cliente).
 */
export function ArgentinaMode() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: 22 }).map((_, i) => {
        const isFlag = i % 3 === 0;
        return {
          id: i,
          flag: isFlag,
          left: Math.random() * 100,
          delay: Math.random() * 9,
          dur: 7 + Math.random() * 7,
          size: isFlag ? 16 + Math.random() * 8 : 6 + Math.random() * 5,
          color: CONFETTI[i % CONFETTI.length],
          sway: `${Math.random() > 0.5 ? "" : "-"}${20 + Math.random() * 40}px`,
          op: isFlag ? 0.85 : 0.5,
          round: Math.random() > 0.5,
        };
      }),
    );
  }, []);

  return (
    <>
      {/* Cintita celeste/blanca/celeste arriba de todo */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1.5 bg-[linear-gradient(180deg,#75AADB,#75AADB_33%,#ffffff_33%,#ffffff_66%,#75AADB_66%,#75AADB)]" />

      {/* Lluvia de banderitas + confeti */}
      <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 block leading-none"
            style={
              {
                left: `${p.left}%`,
                fontSize: p.flag ? p.size : undefined,
                width: p.flag ? undefined : p.size,
                height: p.flag ? undefined : p.size,
                background: p.flag ? undefined : p.color,
                borderRadius: p.flag ? undefined : p.round ? "9999px" : "1px",
                animation: `arg-drift ${p.dur}s linear ${p.delay}s infinite`,
                "--arg-sway": p.sway,
                "--arg-op": String(p.op),
              } as React.CSSProperties
            }
          >
            {p.flag ? "🇦🇷" : ""}
          </span>
        ))}
      </div>
    </>
  );
}
