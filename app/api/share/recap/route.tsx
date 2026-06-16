import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getRecapCard } from "@/lib/share-cards";
import { C, SIZE, CardShell, CardAvatar } from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseEnv()) return new Response("sin config", { status: 500 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("no auth", { status: 401 });
  const userId = claims.claims.sub as string;

  const card = await getRecapCard(supabase, userId);
  if (!card) return new Response("sin fecha", { status: 404 });

  const move =
    card.myMove === null || card.myMove === 0
      ? null
      : card.myMove > 0
        ? { txt: `▲ Subió ${card.myMove} puesto${card.myMove === 1 ? "" : "s"}`, col: C.grass }
        : { txt: `▼ Bajó ${-card.myMove} puesto${card.myMove === -1 ? "" : "s"}`, col: C.red };

  return new ImageResponse(
    (
      <CardShell>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: C.gold, textTransform: "capitalize" }}>
          {card.dayLabel}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 24 }}>
          <CardAvatar src={card.avatarUrl} name={card.nickname} size={130} />
          <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: C.cream }}>
            {card.nickname}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 180, fontWeight: 900, color: C.gold, lineHeight: 1 }}>
            +{card.myPoints}
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: C.cream }}>
            pts esta fecha
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 40 }}>
          {move && (
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: move.col }}>
              {move.txt}
            </div>
          )}
          {card.myRank !== null && (
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: C.cream }}>
              Va {card.myRank}° en el ranking
            </div>
          )}
          {card.bestHit && (
            <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: "rgba(248,245,234,0.85)" }}>
              ✅ Mejor acierto: {card.bestHit}
            </div>
          )}
        </div>

        {card.topNicks.length > 0 && (
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              padding: "20px 28px",
              borderRadius: 24,
              background: "rgba(255,210,63,0.14)",
              border: `2px solid ${C.gold}`,
              fontSize: 36,
              fontWeight: 800,
              color: C.cream,
            }}
          >
            🔥 Mejor de la fecha: {card.topNicks.join(", ")} ({card.topPoints} pts)
          </div>
        )}
      </CardShell>
    ),
    { width: SIZE, height: SIZE },
  );
}
