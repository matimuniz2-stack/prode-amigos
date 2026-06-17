/* ============================================================
   Etiquetas (logros) que se muestran como chips en el ranking.
   Hay dos clases:
   - MANUALES: las pone el admin a mano desde /admin/participants.
     Se guardan en profiles.tags (text[]) con el string completo
     (emoji incluido, ej. "🧊 Pecho frío"). Solo admin/owner las
     escribe (RLS profiles_admin_all).
   - AUTOMÁTICAS: las calcula la app sola desde los resultados — ver
     lib/badges.ts. No se guardan en la DB, se derivan al vuelo.
   Las dos se renderizan igual (chips), con el tono de toneForTag().
   ============================================================ */

export type TagTone = "gold" | "grass" | "red" | "sky";

export interface TagDef {
  /** Texto completo con emoji — también es el valor guardado en la DB. */
  label: string;
  tone: TagTone;
}

/** Etiquetas que el admin asigna a mano (las subjetivas).
 * "Pecho frío" pasó a ser AUTOMÁTICA (ver lib/badges.ts), por eso no está acá. */
export const PRESET_TAGS: TagDef[] = [
  { label: "🧠 El Maestro", tone: "grass" },
];

/** Cuántas etiquetas manuales como máximo por participante. */
export const MAX_TAGS = 4;

/** Tono por etiqueta conocida (manuales + automáticas de lib/badges.ts). */
const TONE_BY_LABEL: Record<string, TagTone> = {
  "🧠 El Maestro": "grass",
  "🧊 Pecho frío": "sky",
  "🎯 Francotirador": "sky",
  "🔥 En racha": "gold",
  "🐐 El GOAT": "gold",
  "🤡 Mufa": "red",
  "👻 El Fantasma": "sky",
  "🐔 El Cagón": "sky",
  "💣 El Cebado": "gold",
  "🏅 MVP de la Fecha": "gold",
};

/** Estilos de chip pensados para fondo claro (cards crema del ranking/admin). */
export const TAG_TONE_CLASS: Record<TagTone, string> = {
  gold: "border-amber-400 bg-amber-100 text-amber-700",
  grass: "border-emerald-400 bg-emerald-100 text-emerald-700",
  red: "border-red-300 bg-red-100 text-red-700",
  sky: "border-sky-400 bg-sky-100 text-sky-700",
};

/** Tono de una etiqueta (default grass para etiquetas desconocidas). */
export function toneForTag(label: string): TagTone {
  return TONE_BY_LABEL[label] ?? "grass";
}

/** Qué significa cada insignia (para la ficha que se abre al tocarla). */
const TAG_DESC_BY_LABEL: Record<string, string> = {
  "🧠 El Maestro":
    "Distinción del admin para el capo del prode. No se compra, se gana con clase.",
  "🐐 El GOAT": "Vas 1° del ranking. El mejor del prode… por ahora. 🐐",
  "🤡 Mufa": "Último puesto de la tabla. Alguien la tiene que sostener.",
  "🎯 Francotirador":
    "El que más resultados EXACTOS clavó del grupo. Puntería de francotirador.",
  "🔥 En racha": "3 o más aciertos seguidos. Está que arde, no lo toques.",
  "🧊 Pecho frío":
    "No le pegó a quién ganaba en 3+ partidos seguidos. Frío, frío.",
  "👻 El Fantasma":
    "Se comió 2+ cierres seguidos sin cargar pick propio. Aparecé, maestro.",
  "🐔 El Cagón":
    "El que menos goles pronostica. Todo 1-0 y a dormir tranquilo.",
  "💣 El Cebado": "El que más goles pone. Goleada en cada pick, sin miedo.",
  "🏅 MVP de la Fecha":
    "El que más puntos hizo en la última fecha jugada. Figura.",
};

/** Descripción de una etiqueta (fallback genérico si no la conocemos). */
export function descForTag(label: string): string {
  return (
    TAG_DESC_BY_LABEL[label] ??
    "Una insignia del prode. Te la ganaste en la cancha."
  );
}
