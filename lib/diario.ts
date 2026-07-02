import type { Recap } from "@/lib/recap";

function joinNicks(nicks: string[]): string {
  if (nicks.length <= 1) return nicks[0] ?? "—";
  return `${nicks.slice(0, -1).join(", ")} y ${nicks[nicks.length - 1]}`;
}

export interface DiarioStanding {
  nickname: string;
  points: number;
  rank: number;
  /** 🔥 En racha. */
  hot?: boolean;
  /** 🧊 Pecho frío. */
  cold?: boolean;
}

export interface DiarioFixture {
  /** "Argentina vs México" */
  label: string;
  /** "hoy 16:00" / "Sábado, 14 de junio 16:00" */
  whenLabel: string;
}

export interface DiarioInput {
  /** Día de hoy (ART), para el encabezado. */
  todayLabel: string;
  /** Resumen de la última fecha cerrada (puede no haber todavía). */
  recap: Recap | null;
  /** Tabla general ordenada por puesto. */
  standings: DiarioStanding[];
  /** Próximos partidos a jugar. */
  fixtures: DiarioFixture[];
  /** Cuándo cierra el próximo cierre ("hoy 15:00"), para apurar a los vagos. */
  closesLabel: string | null;
  /** Insignias destacadas del momento. */
  extras?: { francotirador?: string | null; fantasma?: string | null };
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Semilla estable por día: las frases picantes rotan con la fecha pero no
 *  cambian entre refrescos del mismo día. */
function daySeed(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * "El Diario del Prode": crónica diaria en texto plano (con emojis) lista para
 * copiar y pegar en el grupo de WhatsApp. Junta la tabla, el resumen de la
 * última fecha, las insignias del momento y lo que se viene. Devuelve null si
 * todavía no hay nada para contar.
 */
export function buildDiario(input: DiarioInput): string | null {
  const { recap, fixtures } = input;
  const ranked = [...input.standings]
    .filter((s) => s.rank > 0)
    .sort((a, b) => a.rank - b.rank);
  const hasScores = ranked.some((s) => s.points > 0);

  if (!hasScores && !recap && fixtures.length === 0) return null;

  const L: string[] = [];
  L.push("📰 *EL DIARIO DEL PRODE*");
  L.push(`🗓️ ${input.todayLabel}`);

  // 1) La tabla general.
  if (hasScores) {
    L.push("");
    L.push("🏆 *La tabla*");
    for (const s of ranked.slice(0, 5)) {
      const pos = s.rank <= 3 ? MEDALS[s.rank - 1] : `${s.rank}°`;
      const fuego = s.hot ? " 🔥" : s.cold ? " 🧊" : "";
      L.push(`${pos} ${s.nickname} — ${s.points} pts${fuego}`);
    }
    // Comentarios picantes del día: se elige según la situación de la tabla
    // y la variante rota con la fecha. Máximo 3 para no empastar el diario.
    if (ranked.length >= 2) {
      const seed = daySeed(input.todayLabel);
      const pick = (arr: string[], salt: number) =>
        arr[(seed + salt) % arr.length];
      const lider = ranked[0].nickname;
      const segundo = ranked[1].nickname;
      const gap = ranked[0].points - ranked[1].points;
      const punteroSolo = ranked[1].rank !== 1;
      const picantes: string[] = [];

      if (punteroSolo) {
        picantes.push(
          pick(
            [
              `😎 Bien tranquilo sentado en la puntita está *${lider}*, gozando rico! 🔥🔥`,
              `🍑 *${lider}* sigue sentado en la puntita y le gusta, eh. No se quiere bajar más.`,
              `👑 *${lider}* arriba de todos una vez más. Y abajo haciendo fila, pidiendo turno.`,
            ],
            1,
          ),
        );
      } else {
        picantes.push(
          pick(
            [
              `🤝 ${lider} y ${segundo} igualados en la punta, mano a mano.`,
              `🔥 ${lider} y ${segundo} comparten la punta hace rato... eso ya no es amistad, es otra cosa.`,
              `🛏️ ${lider} y ${segundo} duermen en la misma punta. Apretaditos.`,
            ],
            2,
          ),
        );
      }

      if (punteroSolo && gap === 0) {
        picantes.push(
          `😬 ${segundo} tiene los mismos puntos y ${lider} zafa por el desempate: están piel con piel.`,
        );
      } else if (punteroSolo && gap <= 4) {
        picantes.push(
          pick(
            [
              `👉 Ojo ${lider}: ${segundo} se la está apoyando. Está a ${gap} y empujando fuerte.`,
              `🥵 ${segundo} está tan pegado que ${lider} ya le siente la respiración en la nuca... y ni se corre.`,
              `😳 ${segundo} a ${gap} puntito${gap === 1 ? "" : "s"}: una fecha buena y se la pone a ${lider}.`,
            ],
            3,
          ),
        );
      } else if (punteroSolo && gap >= 15) {
        picantes.push(
          pick(
            [
              `🚀 ${lider} se escapó: le saca ${gap} al segundo.`,
              `💨 ${lider} se fue tan lejos que al resto solo le queda mirarle la espalda. Y admirarla.`,
            ],
            4,
          ),
        );
      }

      // Pelotón respirándole al puntero: 3+ a 6 puntos o menos.
      const encima = ranked.filter(
        (s) => s.rank > 1 && ranked[0].points - s.points <= 6,
      ).length;
      if (punteroSolo && encima >= 3) {
        picantes.push(
          pick(
            [
              `🫂 A ${lider} le gusta tener ${encima} tipos encima: los tiene a todos a menos de 6.`,
              `🧗 Hay ${encima} tipos trepándole por la espalda a ${lider}. Y el loco tranquilo, disfrutando.`,
            ],
            5,
          ),
        );
      }

      // El último, solo si está último en serio (sin empate con el anteúltimo).
      const ultimo = ranked[ranked.length - 1];
      if (
        ranked.length >= 4 &&
        ultimo.points < ranked[ranked.length - 2].points
      ) {
        picantes.push(
          pick(
            [
              `🧎 ${ultimo.nickname} abajo de todos, bancándose lo que le tiran. Y vuelve por más.`,
              `🕳️ ${ultimo.nickname} último y cómodo: hay gente a la que esa posición le encanta.`,
              `🛁 ${ultimo.nickname} mira a todos desde abajo. Dicen que desde ahí la vista es... interesante.`,
            ],
            6,
          ),
        );
      }

      for (const p of picantes.slice(0, 3)) L.push(p);
    }
  }

  // 2) La fecha pasada.
  if (recap) {
    L.push("");
    L.push(`📋 *La fecha pasada* — ${recap.dayLabel}`);
    if (recap.topNicks.length > 0) {
      L.push(
        `👑 Crack: *${joinNicks(recap.topNicks)}* con ${recap.topPoints} pts.`,
      );
    } else {
      L.push("🥶 Fecha para el olvido: no sumó nadie.");
    }
    if (recap.exactos.length > 0) {
      L.push("🎯 Clavadas:");
      for (const e of recap.exactos) {
        L.push(`• ${e.nickname} clavó el ${e.score} de ${e.matchLabel}`);
      }
    }
    if (recap.plenos.length > 0) {
      L.push("💀 No la pegó nadie:");
      for (const p of recap.plenos) L.push(`• ${p}`);
    }
    if (recap.bottomNicks.length > 0) {
      L.push(
        `🤡 La mufa: ${joinNicks(recap.bottomNicks)} con ${recap.bottomPoints} pts.`,
      );
    }
    const dato: string[] = [];
    if (recap.totalGoals > 0) dato.push(`${recap.totalGoals} goles`);
    if (recap.goleada) dato.push(`goleada: ${recap.goleada}`);
    if (dato.length > 0) L.push(`📊 ${dato.join(" · ")}`);
  }

  // 3) Insignias del momento.
  const ins: string[] = [];
  if (input.extras?.francotirador) {
    ins.push(`🎯 Francotirador: ${input.extras.francotirador}`);
  }
  if (input.extras?.fantasma) {
    ins.push(`👻 Fantasma (no aparece): ${input.extras.fantasma}`);
  }
  if (ins.length > 0) {
    L.push("");
    for (const i of ins) L.push(i);
  }

  // 4) Lo que se viene.
  if (fixtures.length > 0) {
    L.push("");
    L.push("📅 *Lo que se viene*");
    for (const f of fixtures) L.push(`• ${f.whenLabel} — ${f.label}`);
    if (input.closesLabel) {
      L.push(`⏰ Cierra ${input.closesLabel}. Cargá antes, no seas fantasma.`);
    }
  }

  L.push("");
  L.push("⚽ prodelospibes.com");
  return L.join("\n");
}
