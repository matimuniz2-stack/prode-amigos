// Polling de resultados desde ESPN. Lo dispara pg_cron (invoke_poll_results,
// cada 1 min cuando hay partidos en vivo) con el secret del Vault como Bearer.
// La validación real del secret la hacen las RPCs contra el Vault.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runPollResults } from "@/lib/poll-results";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = auth.replace(/^bearer\s+/i, "").trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Falta el secret" },
      { status: 401 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );

  try {
    const summary = await runPollResults(supabase, secret);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const unauthorized = message.toLowerCase().includes("no autorizado");
    return NextResponse.json(
      { ok: false, error: message },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
