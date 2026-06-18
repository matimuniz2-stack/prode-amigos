import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getRankingCard } from "@/lib/share-cards";
import { C, SIZE, CardShell, CardAvatar } from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return new Response("sin config", { status: 500 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("no auth", { status: 401 });

  const origin = new URL(req.url).origin;
  const { poolLabel, top } = await getRankingCard(supabase);

  // Sizing dinámico: las filas se achican según cuántos jugadores haya, para que
  // SIEMPRE entren todos en los 1080px (antes se cortaban los últimos puestos).
  const n = Math.max(top.length, 1);
  const gap = n > 9 ? 7 : 10;
  const budget = 748; // alto disponible para las filas (después del título)
  const rowH = Math.max(38, Math.min(98, Math.floor((budget - (n - 1) * gap) / n)));
  const avatar = Math.round(rowH * 0.7);
  const padV = Math.max(4, Math.round((rowH - avatar) / 2));
  const nameFont = Math.round(rowH * 0.4);
  const ptsFont = Math.round(rowH * 0.46);
  const ptsLabelFont = Math.round(rowH * 0.26);
  const medalFont = Math.round(rowH * 0.42);
  const rankFont = Math.round(rowH * 0.36);

  return new ImageResponse(
    (
      <CardShell>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: C.cream }}>
            La tabla
          </div>
          {poolLabel && (
            <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.gold }}>
              🏆 {poolLabel}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 20, gap }}>
          {top.map((p, i) => {
            const podium = i < 3;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: `${padV}px 22px`,
                  borderRadius: 20,
                  background: podium ? "rgba(255,210,63,0.14)" : "rgba(248,245,234,0.06)",
                  border: podium ? `2px solid ${C.gold}` : "2px solid rgba(248,245,234,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 56,
                    justifyContent: "center",
                    fontSize: podium ? medalFont : rankFont,
                    fontWeight: 900,
                    color: podium ? C.gold : "rgba(248,245,234,0.6)",
                  }}
                >
                  {podium ? MEDAL[i] : p.rank}
                </div>
                <CardAvatar src={p.avatarUrl} name={p.nickname} size={avatar} origin={origin} />
                <div style={{ display: "flex", flex: 1, fontSize: nameFont, fontWeight: 800, color: C.cream }}>
                  {p.nickname}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", fontSize: ptsFont, fontWeight: 900, color: C.gold }}>
                    {p.points}
                  </div>
                  <div style={{ display: "flex", fontSize: ptsLabelFont, fontWeight: 700, color: "rgba(248,245,234,0.6)" }}>
                    pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardShell>
    ),
    { width: SIZE, height: SIZE },
  );
}
