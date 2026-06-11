"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca los datos del server component cada `intervalMs` mientras
 * `enabled` sea true (lo prendemos cuando hay partidos en vivo).
 */
export function LiveRefresher({
  enabled,
  intervalMs = 60_000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
