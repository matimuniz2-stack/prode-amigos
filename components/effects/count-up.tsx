"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que sube animado tipo odómetro al montar (de `from` a `value`).
 * Respeta prefers-reduced-motion. Pensado para puntos ("47 pts", "+3").
 */
export function CountUp({
  value,
  from = 0,
  durationMs = 900,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  from?: number;
  durationMs?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [n, setN] = useState(from);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === from) {
      setN(value);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setN(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // Re-anima cuando cambia el valor objetivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {prefix}
      {n}
      {suffix}
    </span>
  );
}
