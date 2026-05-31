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

/** Etiquetas que el admin asigna a mano (las subjetivas). */
export const PRESET_TAGS: TagDef[] = [
  { label: "🧠 El Maestro", tone: "grass" },
  { label: "🧊 Pecho frío", tone: "sky" },
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
