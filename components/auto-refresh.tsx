"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca el Server Component cada `seconds` (polling, no Realtime).
 * Sirve para que el leaderboard se actualice solo cuando el admin
 * finaliza un partido, sin suscripciones (ajuste PASO 0: Realtime fuera del MVP).
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
