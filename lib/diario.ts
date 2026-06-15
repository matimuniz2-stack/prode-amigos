import type { Recap } from "@/lib/recap";

function joinNicks(nicks: string[]): string {
  if (nicks.length <= 1) return nicks[0] ?? "—";
  return `${nicks.slice(0, -1).join(", ")} y ${nicks[nicks.length - 1]}`;
}

/**
 * "El Diario del Prode": arma un texto plano (con emojis) tipo crónica de la
 * última fecha, pensado para copiar y pegar en el grupo de WhatsApp.
 */
export function buildDiario(recap: Recap): string {
  const lines: string[] = [];
  lines.push("📰 *EL DIARIO DEL PRODE*");
  lines.push(`🗓️ ${recap.dayLabel}`);
  lines.push("");

  if (recap.topNicks.length > 0) {
    const quien = joinNicks(recap.topNicks);
    lines.push(
      `👑 Crack de la fecha: *${quien}* con ${recap.topPoints} puntos.`,
    );
  } else {
    lines.push("🥶 Fecha para el olvido: no sumó nadie. Vergüenza ajena.");
  }

  if (recap.exactos.length > 0) {
    lines.push("");
    lines.push("🎯 *Clavadas:*");
    for (const e of recap.exactos) {
      lines.push(`• ${e.nickname} clavó el ${e.score} de ${e.matchLabel}`);
    }
  }

  if (recap.plenos.length > 0) {
    lines.push("");
    lines.push("💀 *No la pegó nadie:*");
    for (const p of recap.plenos) {
      lines.push(`• ${p}`);
    }
  }

  lines.push("");
  lines.push("⚽ prodelospibes.com");
  return lines.join("\n");
}
