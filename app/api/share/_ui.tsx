import type { ReactNode } from "react";

// Paleta de la cancha (espejo de tailwind.config.ts).
export const C = {
  pitch: "#0B3D2E",
  deep: "#06281F",
  cream: "#F8F5EA",
  gold: "#FFD23F",
  ink: "#111827",
  grass: "#16A34A",
  red: "#E63946",
};

export const SIZE = 1080;

/** Lienzo 1080×1080 con fondo cancha + branding arriba y abajo. */
export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(160deg, ${C.pitch} 0%, ${C.deep} 100%)`,
        color: C.cream,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: 2,
          color: C.gold,
          textTransform: "uppercase",
        }}
      >
        ⚽ Prode entre amigos
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          marginTop: 28,
        }}
      >
        {children}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          fontSize: 26,
          fontWeight: 700,
          color: "rgba(248,245,234,0.55)",
        }}
      >
        Mundial 2026 🏆
      </div>
    </div>
  );
}

/** Avatar circular: foto si hay, inicial si no.
 *  Satori corre en el server y necesita URLs absolutas, así que las rutas
 *  relativas (ej. "/avatars/x.jpeg") se resuelven contra `origin`. */
export function CardAvatar({
  src,
  name,
  size,
  origin,
}: {
  src: string | null;
  name: string;
  size: number;
  origin?: string;
}) {
  const ring = `${Math.max(3, Math.round(size / 18))}px solid ${C.gold}`;
  const absSrc =
    src && src.startsWith("/") && origin ? `${origin}${src}` : src;
  if (absSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={absSrc}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: size,
          objectFit: "cover",
          border: ring,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(248,245,234,0.15)",
        border: ring,
        fontSize: size * 0.46,
        fontWeight: 900,
        color: C.cream,
      }}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}
