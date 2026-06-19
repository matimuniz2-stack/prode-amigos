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
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    // Solo refrescamos mientras la pestaña está visible: si el usuario la dejó
    // en segundo plano no tiene sentido seguir golpeando el server (cada
    // refresh recalcula todo el ranking). Al volver, refresca una vez para
    // ponerse al día y retoma el intervalo.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);
  return null;
}
