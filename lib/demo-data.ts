/* ============================================================
   ⚠️  DATOS DE EJEMPLO — NO SON REALES
   ------------------------------------------------------------
   El ranking, la racha, los logros y las novedades todavía NO
   tienen lógica real (eso es Fase 3+). Están mockeados acá, en
   un solo lugar, para poder mostrar la home con la identidad
   final. Cuando exista la data real, se reemplaza desde acá.

   IMPORTANTE: cablear o esconder estas secciones ANTES de
   agregar a los amigos como test users en Google Cloud. Hoy
   solo el owner puede loguearse, así que nadie más ve estos
   números inventados — pero con el pozo de plata de por medio,
   no pueden quedar visibles cuando entren los demás.
   ============================================================ */

export interface DemoPlayer {
  rank: number;
  name: string;
  points: number;
}

export const DEMO_RANKING: DemoPlayer[] = [
  { rank: 1, name: "Nacho", points: 24 },
  { rank: 2, name: "Mati", points: 21 },
  { rank: 3, name: "Rama", points: 19 },
  { rank: 4, name: "Juan", points: 17 },
  { rank: 5, name: "Fede", points: 15 },
  { rank: 6, name: "Santi", points: 11 },
];

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
  { emoji: "🕯️", label: "Necesita milagro", tone: "red" },
];

export interface DemoNews {
  emoji: string;
  text: string;
}

export const DEMO_NEWS: DemoNews[] = [
  { emoji: "🎉", text: "Nacho clavó resultado exacto y se subió al podio." },
  { emoji: "😰", text: "Juan erró 5 seguidos. Preocupante." },
  { emoji: "📺", text: "Mati sigue primero, pero con ayuda del VAR." },
  { emoji: "💔", text: "Rama apostó con el corazón y perdió otra vez." },
  { emoji: "🚀", text: "Fede necesita una remontada épica." },
];

/** Puesto y racha son demo; el "próximo partido" sale de data real. */
export const DEMO_STANDING = { position: 3, total: 12, streak: 2 };
