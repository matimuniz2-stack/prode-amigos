import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getFinalData } from "@/lib/final";
import { C, SIZE, CardAvatar } from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

/** La foto del campeón: poster dorado con el ganador del prode. */
export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return new Response("sin config", { status: 500 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("no auth", { status: 401 });

  const origin = new URL(req.url).origin;
  const data = await getFinalData(supabase);
  if (!data.done || !data.champion) {
    return new Response("todavía no hay campeón", { status: 404 });
  }
  const champ = data.champion;
  const runnerUp = data.podium[1] ?? null;

  const stats: { value: string; label: string }[] = [
    { value: String(champ.points), label: "PUNTOS" },
    { value: String(data.championExactos), label: "EXACTOS" },
    { value: "#1", label: `DE ${data.standings.length}` },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(160deg, ${C.pitch} 0%, ${C.deep} 100%)`,
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 48,
            background: "linear-gradient(165deg, #FFD23F 0%, #f0b800 100%)",
            border: `10px solid ${C.cream}`,
            padding: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: 8,
              color: C.deep,
            }}
          >
            CAMPEÓN · MUNDIAL 2026
          </div>

          <div style={{ display: "flex", fontSize: 90, marginTop: 8 }}>👑</div>

          <CardAvatar
            src={champ.avatarUrl}
            name={champ.nickname}
            size={300}
            origin={origin}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: 20,
              fontSize: 96,
              fontWeight: 900,
              color: C.ink,
            }}
          >
            {champ.nickname.toUpperCase()} 🏆
          </div>

          <div style={{ display: "flex", gap: 60, marginTop: 28 }}>
            {stats.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 64,
                    fontWeight: 900,
                    color: C.deep,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: "rgba(6,40,31,0.7)",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {champ.prize > 0 && (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                borderRadius: 999,
                background: C.deep,
                color: C.gold,
                fontSize: 40,
                fontWeight: 900,
                padding: "14px 40px",
              }}
            >
              💰 se lleva {money(champ.prize, data.currency)}
            </div>
          )}

          {runnerUp && (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 28,
                fontWeight: 700,
                color: "rgba(6,40,31,0.65)",
              }}
            >
              le ganó por {champ.points - runnerUp.points} pts a {runnerUp.nickname}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 24,
            fontSize: 28,
            fontWeight: 800,
            color: "rgba(248,245,234,0.6)",
          }}
        >
          <div style={{ display: "flex" }}>⚽ Prode entre amigos</div>
          <div style={{ display: "flex" }}>Mundial 2026 🏆</div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
