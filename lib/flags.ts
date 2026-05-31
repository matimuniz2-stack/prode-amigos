/* ============================================================
   Banderas como imagen (flagcdn.com) en vez de emoji.
   Windows no renderiza los emoji de bandera (🇧🇷 se ve "BR"), así que
   las mostramos como <img>. El código ISO alpha-2 sale del propio
   emoji (dos "regional indicators" → 2 letras). Para los escudos
   británicos (Escocia/Inglaterra/etc., que en el seed son 🏴 y no se
   pueden derivar) usamos el código FIFA del equipo.
   ============================================================ */

// FIFA → código de flagcdn para banderas que no se derivan del emoji.
const FIFA_OVERRIDE: Record<string, string> = {
  SCO: "gb-sct",
  ENG: "gb-eng",
  WAL: "gb-wls",
  NIR: "gb-nir",
};

/** Convierte un emoji de bandera (🇧🇷) a su código ISO alpha-2 ("br"). */
export function emojiToAlpha2(emoji?: string | null): string | null {
  if (!emoji) return null;
  const cps = Array.from(emoji).map((c) => c.codePointAt(0) ?? 0);
  // Regional Indicator Symbols: U+1F1E6 (A) .. U+1F1FF (Z)
  const ri = cps.filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  if (ri.length !== 2) return null;
  const a = String.fromCharCode(ri[0] - 0x1f1e6 + 97);
  const b = String.fromCharCode(ri[1] - 0x1f1e6 + 97);
  return a + b;
}

/** Código de bandera para flagcdn a partir del emoji y/o el código FIFA. */
export function flagCode(
  emoji?: string | null,
  code?: string | null,
): string | null {
  const override = code ? FIFA_OVERRIDE[code.toUpperCase()] : undefined;
  return override ?? emojiToAlpha2(emoji);
}

/** URL de la imagen de bandera (PNG por alto, escalable). */
export function flagUrl(alpha2: string, heightPx = 60): string {
  return `https://flagcdn.com/h${heightPx}/${alpha2}.png`;
}
