"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["#FFD23F", "#F8F5EA", "#16A34A", "#75AADB"];

interface Piece {
  id: number;
  left: number;
  delay: number;
  dur: number;
  size: number;
  color: string;
  round: boolean;
}

/**
 * Estallido de papelitos de una sola pasada (se autolimpia). Se posiciona
 * absoluto sobre el ancestro posicionado más cercano. Reusa el keyframe
 * `confetti-fall` de globals.css. Las piezas se generan en el cliente
 * (useEffect) para no romper la hidratación con Math.random.
 */
export function ConfettiBurst({
  count = 42,
  durationMs = 2800,
  className,
}: {
  count?: number;
  durationMs?: number;
  className?: string;
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.8 + Math.random() * 1.4,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.55,
      })),
    );
    const id = setTimeout(() => setPieces([]), durationMs);
    return () => clearTimeout(id);
  }, [count, durationMs]);

  if (pieces.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
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
            animation: `confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
