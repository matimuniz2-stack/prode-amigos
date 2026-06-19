import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import type { Database } from "@/lib/types/database";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tag para invalidar TODOS los cómputos globales cacheados (insignias
 * automáticas, gráfico de carrera) cuando cambian resultados o picks.
 */
export const SCORING_TAG = "scoring-data";

/** Invalida los cómputos globales cacheados. Llamar después de finalizar un
 *  resultado, recalcular o guardar un pick, para que el ranking se vea al toque
 *  (además del revalidate de 60s que ya los refresca solos). */
export function revalidateScoring() {
  // Next 16: revalidateTag pide un profile como 2º arg; "max" = purga on-demand.
  revalidateTag(SCORING_TAG, "max");
}

/**
 * Cliente server-only SIN cookies para las lecturas que viven adentro de
 * unstable_cache (donde no se pueden leer cookies de sesión). Usa service-role
 * para ver TODO igual que un admin — son agregados globales de SOLO LECTURA,
 * nunca escribe. Devuelve null si no está configurado el service-role, para
 * degradar al cliente normal por-request sin romper nada.
 */
export function cachedReadClient(): ServerClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false },
  }) as unknown as ServerClient;
}
