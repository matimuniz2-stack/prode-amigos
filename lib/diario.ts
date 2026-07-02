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
    // El líder en soledad (si hay empate en la punta, abajo va "igualados").
    if (ranked.length > 0 && ranked[1]?.rank !== 1) {
      L.push(
        `😎 Bien tranquilo sentado en la puntita está *${ranked[0].nickname}*, gozando rico! 🔥🔥`,
      );
    }
    if (ranked.length >= 2) {
      const gap = ranked[0].points - ranked[1].points;
      const lider = ranked[0].nickname;
      const segundo = ranked[1].nickname;
      if (gap === 0) {
        L.push(`🤝 ${lider} y ${segundo} igualados en la punta, mano a mano.`);
      } else if (gap <= 4) {
        L.push(`👀 ${lider} le saca apenas ${gap} a ${segundo}. Picante arriba.`);
      } else if (gap >= 15) {
        L.push(`🚀 ${lider} se escapó: le saca ${gap} al segundo.`);
      }
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
