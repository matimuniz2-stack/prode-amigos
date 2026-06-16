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

  return new ImageResponse(
    (
      <CardShell>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 900, color: C.cream }}>
            La tabla
          </div>
          {poolLabel && (
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: C.gold }}>
              🏆 {poolLabel}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 14 }}>
          {top.map((p, i) => {
            const podium = i < 3;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: "14px 24px",
                  borderRadius: 24,
                  background: podium ? "rgba(255,210,63,0.14)" : "rgba(248,245,234,0.06)",
                  border: podium ? `2px solid ${C.gold}` : "2px solid rgba(248,245,234,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 64,
                    justifyContent: "center",
                    fontSize: podium ? 46 : 40,
                    fontWeight: 900,
                    color: podium ? C.gold : "rgba(248,245,234,0.6)",
                  }}
                >
                  {podium ? MEDAL[i] : p.rank}
                </div>
                <CardAvatar src={p.avatarUrl} name={p.nickname} size={76} origin={origin} />
                <div style={{ display: "flex", flex: 1, fontSize: 44, fontWeight: 800, color: C.cream }}>
                  {p.nickname}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", fontSize: 48, fontWeight: 900, color: C.gold }}>
                    {p.points}
                  </div>
                  <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "rgba(248,245,234,0.6)" }}>
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
