/* ============================================================
   Etiquetas (logros) que el admin le pone a cada participante.
   Se guardan en profiles.tags (text[]) — el string completo, con
   emoji incluido (ej. "🤡 Mufa"). El admin las edita desde
   /admin/participants; se muestran como chips en el ranking.
   Solo admin/owner puede escribirlas (RLS profiles_admin_all).
   ============================================================ */

export type TagTone = "gold" | "grass" | "red" | "sky";

export interface TagDef {
  /** Texto completo con emoji — también es el valor guardado en la DB. */
  label: string;
  tone: TagTone;
}

export const PRESET_TAGS: TagDef[] = [
  { label: "🧠 El sabio", tone: "grass" },
  { label: "🎯 Francotirador", tone: "sky" },
  { label: "🔥 En racha", tone: "gold" },
  { label: "🤡 Mufa", tone: "red" },
  { label: "🧊 Pecho frío", tone: "sky" },
  { label: "🐐 El GOAT", tone: "gold" },
];

/** Cuántas etiquetas como máximo por participante. */
export const MAX_TAGS = 4;

/** Estilos de chip pensados para fondo claro (cards crema del ranking/admin). */
export const TAG_TONE_CLASS: Record<TagTone, string> = {
  gold: "border-amber-400 bg-amber-100 text-amber-700",
  grass: "border-emerald-400 bg-emerald-100 text-emerald-700",
  red: "border-red-300 bg-red-100 text-red-700",
  sky: "border-sky-400 bg-sky-100 text-sky-700",
};

/** Tono de una etiqueta (default grass para etiquetas que no son preset). */
export function toneForTag(label: string): TagTone {
  return PRESET_TAGS.find((t) => t.label === label)?.tone ?? "grass";
}
