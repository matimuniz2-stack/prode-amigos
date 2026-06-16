import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getFichaCard } from "@/lib/share-cards";
import { C, SIZE, CardShell, CardAvatar } from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return new Response("sin config", { status: 500 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("no auth", { status: 401 });

  const target = new URL(req.url).searchParams.get("u") || (claims.claims.sub as string);
  const card = await getFichaCard(supabase, target);
  if (!card) return new Response("sin ficha", { status: 404 });

  return new ImageResponse(
    (
      <CardShell>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 4, color: C.gold }}>
          🧬 ADN FUTBOLERO
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 28 }}>
          <CardAvatar src={card.avatarUrl} name={card.nickname} size={180} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", fontSize: 78, fontWeight: 900, color: C.cream }}>
              {card.nickname}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              {card.rank !== null && (
                <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: C.gold }}>
                  {card.rank}° puesto
                </div>
              )}
              <div style={{ display: "flex", fontSize: 44, fontWeight: 900, color: C.cream }}>
                {card.points} pts
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 48 }}>
          {card.traits.length > 0 ? (
            card.traits.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "18px 28px",
                  borderRadius: 24,
                  background: "rgba(248,245,234,0.08)",
                  border: "2px solid rgba(248,245,234,0.12)",
                  fontSize: 46,
                  fontWeight: 800,
                  color: C.cream,
                }}
              >
                <div style={{ display: "flex", fontSize: 52 }}>{t.emoji}</div>
                {t.label}
              </div>
            ))
          ) : (
            <div style={{ display: "flex", fontSize: 40, color: "rgba(248,245,234,0.7)" }}>
              Todavía sin rasgos suficientes
            </div>
          )}
        </div>

        {card.avgGoals !== null && (
          <div style={{ display: "flex", marginTop: "auto", fontSize: 38, fontWeight: 700, color: "rgba(248,245,234,0.8)" }}>
            ⚽ {card.avgGoals.toFixed(1)} goles de promedio por pick
          </div>
        )}
      </CardShell>
    ),
    { width: SIZE, height: SIZE },
  );
}
