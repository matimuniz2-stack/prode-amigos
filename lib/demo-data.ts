/* ============================================================
   ⚠️  DATOS DE EJEMPLO — solo logros y novedades.
   No hay data real para estas dos secciones todavía (los logros
   reales serán las etiquetas de profiles.tags; las novedades
   necesitan un feed). Están acá, marcadas, para mostrar el
   dashboard completo. SACAR/CABLEAR antes de invitar a los amigos.
   El ranking y los stats del dashboard SÍ son data real.
   ============================================================ */

export type BadgeTone = "gold" | "grass" | "red" | "sky";

export interface DemoBadge {
  emoji: string;
  label: string;
  tone: BadgeTone;
}

export const DEMO_BADGES: DemoBadge[] = [
  { emoji: "🧠", label: "El sabio", tone: "grass" },
  { emoji: "🎯", label: "Francotirador", tone: "sky" },
  { emoji: "🔥", label: "En racha", tone: "gold" },
  { emoji: "🤡", label: "Mufa", tone: "red" },
  { emoji: "🧊", label: "Pecho frío", tone: "sky" },
  { emoji: "🐐", label: "El GOAT", tone: "gold" },
];

export interface DemoNews {
  emoji: string;
  text: string;
}

export const DEMO_NEWS: DemoNews[] = [
  { emoji: "🎉", text: "Nacho clavó resultado exacto y se subió al podio." },
  { emoji: "😰", text: "Juan erró 5 seguidos. Preocupante." },
  { emoji: "📺", text: "Mati sigue segundo, pero con ayuda del VAR." },
  { emoji: "💔", text: "Rama apostó con el corazón y perdió otra vez." },
];
